import { readFile } from 'node:fs/promises';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { getModelToken } from '@nestjs/mongoose';
import { mongo, type Model } from 'mongoose';
import { AppModule } from '../app.module.js';
import { parseTargetConfig } from '../common/config/target-config.js';
import { EdgeAgentRegistrationService } from '../edge-agents/edge-agent-registration.service.js';
import { parseCsv, resolveDataPath } from '../common/data/data-files.js';
import {
  classifyTrafficStatus,
  CSV_SEED_AGENT_ID,
  PREDICTION_HISTORY_LIMIT,
  PREDICTION_HORIZONS,
} from '../common/domain/traffic.models.js';
import { NodePredictionHistory } from '../database/schemas/node-prediction-history.schema.js';
import {
  LATEST_PREDICTION_TTL_SECONDS,
  NodePredictionLatest,
} from '../database/schemas/node-prediction-latest.schema.js';
import { parseSpeedCsv } from '../providers/prediction/simulated-csv-prediction.provider.js';

async function seed(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, {
    logger: false,
    abortOnError: false,
  });
  try {
    const config = app.get(ConfigService);
    const dataDir = config.get<string>('DATA_DIR', 'data');
    const [targetJson, directionCsv, speedCsv] = await Promise.all([
      readFile(resolveDataPath(dataDir, 'target.json'), 'utf8'),
      readFile(resolveDataPath(dataDir, 'direction_info.csv'), 'utf8'),
      readFile(resolveDataPath(dataDir, 'speed.csv'), 'utf8'),
    ]);
    const dataset = parseSpeedCsv(
      speedCsv,
      config.get<string>('DATA_TIMEZONE_OFFSET', '+07:00'),
    );
    const latestSource = dataset.timeline.at(-1);
    if (latestSource === undefined)
      throw new Error('speed.csv has no usable samples');

    const { config: target, warnings } = parseTargetConfig(
      JSON.parse(targetJson) as unknown,
    );
    if (warnings.length) throw new Error(warnings.join('. '));
    const csvIndices = new Map<string, number>();
    for (const row of parseCsv(directionCsv)) {
      const index = Number(row['index']);
      if (
        row['direction'] &&
        row['index'] &&
        Number.isSafeInteger(index) &&
        index >= 0
      ) {
        csvIndices.set(row['direction'], index);
      }
    }
    const topology = await app.get(EdgeAgentRegistrationService).register(
      {
        agentId: CSV_SEED_AGENT_ID,
        name: 'Edge Agent Khu vực ĐH Bách Khoa',
        region: 'Quận 10, TP.HCM',
      },
      {
        nodes: Object.fromEntries(
          Object.entries(target.nodes).map(([id, node]) => [
            id,
            { ...node, index: node.index ?? csvIndices.get(id) },
          ]),
        ),
        connections: target.connections,
      },
    );

    // Put the archived CSV into today's retention window and keep the same timestamps on reruns today.
    const anchor = new Date();
    anchor.setUTCHours(0, 0, 0, 0);
    const offset = anchor.getTime() - latestSource;
    const latest = app.get<Model<NodePredictionLatest>>(
      getModelToken(NodePredictionLatest.name),
    );
    const history = app.get<Model<NodePredictionHistory>>(
      getModelToken(NodePredictionHistory.name),
    );
    let observationCount = 0;
    let seededNodes = 0;

    for (const { id: nodeId, localId } of topology.nodes) {
      const index = csvIndices.get(localId) ?? target.nodes[localId].index;
      if (index === undefined) continue;
      const samples = dataset.byIndex.get(index);
      if (!samples?.length) continue;

      const observedAt = new Date(samples[samples.length - 1].t + offset);
      const cutoff = new Date(
        Date.now() - LATEST_PREDICTION_TTL_SECONDS * 1000,
      );
      if (
        await latest
          .exists({
            nodeId,
            observedAt: { $gt: observedAt },
            updatedAt: { $gt: cutoff },
          })
          .exec()
      ) {
        continue;
      }

      const measurements = [
        ...new Map(samples.map((sample) => [sample.t, sample])).values(),
      ]
        .slice(-PREDICTION_HISTORY_LIMIT)
        .map(({ t, ratio, confidence }) => ({
          nodeId,
          edgeAgentId: CSV_SEED_AGENT_ID,
          speedRatio: ratio,
          confidence,
          timestamp: new Date(t + offset),
        }));
      const existing = await history
        .find({
          nodeId,
          edgeAgentId: CSV_SEED_AGENT_ID,
          timestamp: { $in: measurements.map(({ timestamp }) => timestamp) },
        })
        .select('timestamp')
        .lean()
        .exec();
      const existingTimes = new Set(
        existing.map(({ timestamp }) => timestamp.getTime()),
      );
      const pending = measurements.filter(
        ({ timestamp }) => !existingTimes.has(timestamp.getTime()),
      );
      if (pending.length > 0) await history.insertMany(pending);
      observationCount += pending.length;

      const last = measurements[measurements.length - 1];
      const first = measurements[Math.max(0, measurements.length - 6)];
      const minutes = Math.max(
        1,
        (last.timestamp.getTime() - first.timestamp.getTime()) / 60_000,
      );
      const trend = (last.speedRatio - first.speedRatio) / minutes;
      const forecasts = PREDICTION_HORIZONS.map((horizonMinutes) => {
        const ratio = last.speedRatio + trend * Math.min(horizonMinutes, 15);
        const predictedSpeedRatio =
          Math.round(Math.max(0, Math.min(1, ratio)) * 1000) / 1000;
        return {
          horizonMinutes,
          predictedSpeedRatio,
          status: classifyTrafficStatus(predictedSpeedRatio),
        };
      });

      try {
        const result = await latest
          .updateOne(
            {
              nodeId,
              $or: [
                { observedAt: { $lte: observedAt } },
                { updatedAt: { $lte: cutoff } },
              ],
            },
            {
              $set: {
                nodeId,
                edgeAgentId: CSV_SEED_AGENT_ID,
                currentSpeedRatio: last.speedRatio,
                confidence: last.confidence,
                forecasts,
                observedAt: last.timestamp,
                updatedAt: new Date(),
              },
            },
            { upsert: true },
          )
          .exec();
        seededNodes += result.matchedCount + result.upsertedCount;
      } catch (error) {
        // A live report arrived during the seed for this node.
        if (!(error instanceof mongo.MongoServerError) || error.code !== 11000)
          throw error;
      }
    }

    console.log(
      `MongoDB seed complete for ${CSV_SEED_AGENT_ID}: ${topology.nodes.length} nodes, ${topology.edges.length} edges, ${seededNodes} latest predictions, ${observationCount} new observations.`,
    );
  } finally {
    await app.close();
  }
}

seed().catch((error: unknown) => {
  const message =
    error instanceof Error
      ? error.message.replace(/mongodb(?:\+srv)?:\/\/\S+/g, '[MONGODB_URI]')
      : 'Unknown error';
  console.error(`MongoDB seed failed: ${message}`);
  process.exitCode = 1;
});
