import { Injectable, type OnModuleInit } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { mongo, type Model } from 'mongoose';
import type { EdgePredictionReport } from '../common/domain/traffic.models.js';
import { AbstractPredictionWriter } from '../providers/prediction/prediction-writer.abstract.js';
import { NodePredictionHistory } from './schemas/node-prediction-history.schema.js';
import {
  LATEST_PREDICTION_TTL_SECONDS,
  NodePredictionLatest,
} from './schemas/node-prediction-latest.schema.js';

@Injectable()
export class MongoPredictionWriter
  extends AbstractPredictionWriter
  implements OnModuleInit
{
  constructor(
    @InjectModel(NodePredictionLatest.name)
    private readonly latest: Model<NodePredictionLatest>,
    @InjectModel(NodePredictionHistory.name)
    private readonly history: Model<NodePredictionHistory>,
  ) {
    super();
  }

  async onModuleInit(): Promise<void> {
    await Promise.all([this.latest.init(), this.history.init()]);
  }

  async store(report: EdgePredictionReport): Promise<void> {
    const { nodeId, edgeAgentId, currentSpeedRatio, confidence, observedAt } =
      report;
    const measurement = { nodeId, edgeAgentId, timestamp: observedAt };
    if (!(await this.history.exists(measurement).exec())) {
      await this.history.create({
        ...measurement,
        speedRatio: currentSpeedRatio,
        confidence,
      });
    }

    const now = new Date();
    const filter = {
      nodeId,
      $or: [
        { observedAt: { $lte: observedAt } },
        {
          updatedAt: {
            $lte: new Date(
              now.getTime() - LATEST_PREDICTION_TTL_SECONDS * 1000,
            ),
          },
        },
      ],
    };
    const update = { $set: { ...report, updatedAt: now } };
    try {
      await this.latest.updateOne(filter, update, { upsert: true }).exec();
    } catch (error) {
      // A newer report or a concurrent insert can already own the unique nodeId.
      if (!(error instanceof mongo.MongoServerError) || error.code !== 11000)
        throw error;
      await this.latest.updateOne(filter, update).exec();
    }
  }
}
