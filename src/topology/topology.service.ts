import {
  BadGatewayException,
  GatewayTimeoutException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { isLatLon, isLatLonArray } from '../common/config/target-config.js';
import { DEFAULT_SPEED_LIMIT_KMH, type LatLon } from '../common/domain/traffic.models.js';
import type { ResolvedSegmentDto } from './resolve-segment.dto.js';
import type { PlaceSuggestionDto } from './search-place.dto.js';

const FLOW_SEGMENT_URL = 'https://api.tomtom.com/traffic/services/4/flowSegmentData/absolute/10/json';
const SEARCH_URL = 'https://api.tomtom.com/search/2/search/';
const SEARCH_LIMIT = 5;
const TOMTOM_TIMEOUT_MS = 7_000;
const NO_SEGMENT = 'Không tìm thấy cung đường gần vị trí này. Hãy chọn một điểm khác trên bản đồ.';

interface TomTomResponse {
  flowSegmentData?: {
    freeFlowSpeed?: unknown;
    frc?: unknown;
    coordinates?: { coordinate?: { latitude: unknown; longitude: unknown }[] };
  };
  error?: string;
  detailedError?: { code?: string; message?: string };
}

interface TomTomSearchResponse {
  results?: {
    id?: unknown;
    poi?: { name?: unknown };
    address?: { freeformAddress?: unknown };
    position?: { lat?: unknown; lon?: unknown };
  }[];
}

function text(value: unknown): string {
  return typeof value === 'string' ? value.trim() : '';
}

function segmentCenter(polyline: LatLon[]): LatLon {
  const middle = Math.floor(polyline.length / 2);
  const [lat, lon] = polyline[middle];
  if (polyline.length % 2) return [lat, lon];

  const [previousLat, previousLon] = polyline[middle - 1];
  const averageLongitude = (lon + previousLon) / 2;
  const crossesAntimeridian = Math.abs(lon - previousLon) > 180;
  const midpointLongitude = crossesAntimeridian ? (averageLongitude + 360) % 360 - 180 : averageLongitude;
  return [(previousLat + lat) / 2, midpointLongitude];
}

@Injectable()
export class TopologyService {
  constructor(private readonly config: ConfigService) {}

  async resolveSegment(lat: number, lon: number): Promise<ResolvedSegmentDto> {
    const url = new URL(FLOW_SEGMENT_URL);
    url.searchParams.set('point', `${lat},${lon}`);
    const { status, body } = await this.requestTomTom<TomTomResponse>(url);
    const errorDetails = [body?.error, body?.detailedError?.code, body?.detailedError?.message].join(' ');
    if (status === 404 ||
      (status === 400 && /not[ _-]?found|(?:no|find) (?:road|segment|flow|traffic)/i.test(errorDetails))) {
      throw new NotFoundException(NO_SEGMENT);
    }
    if (!body || status < 200 || status >= 300) {
      throw new BadGatewayException('TomTom trả về phản hồi không hợp lệ. Hãy thử lại.');
    }

    const segment = body.flowSegmentData;
    const coordinates = segment?.coordinates?.coordinate;
    if (!Array.isArray(coordinates) || coordinates.length < 2) {
      throw new NotFoundException(NO_SEGMENT);
    }
    const polyline = coordinates.map((point) => [point?.latitude, point?.longitude]);
    if (!isLatLonArray(polyline)) {
      throw new BadGatewayException('TomTom trả về tọa độ cung đường không hợp lệ.');
    }

    const [segmentLat, segmentLon] = segmentCenter(polyline);
    const freeFlowSpeed = segment?.freeFlowSpeed;
    const speed = typeof freeFlowSpeed === 'number' && Number.isFinite(freeFlowSpeed) ? Math.round(freeFlowSpeed) : 0;
    const frc = segment?.frc;
    return {
      lat: segmentLat,
      lon: segmentLon,
      speedLimitKmh: speed > 0 ? speed : DEFAULT_SPEED_LIMIT_KMH,
      polyline,
      ...(typeof frc === 'string' && frc ? { frc } : {}),
    };
  }

  async searchPlace(query: string): Promise<PlaceSuggestionDto[]> {
    const url = new URL(`${encodeURIComponent(query)}.json`, SEARCH_URL);
    url.searchParams.set('countrySet', 'VN');
    url.searchParams.set('language', 'vi-VN');
    url.searchParams.set('limit', String(SEARCH_LIMIT));

    const { status, body } = await this.requestTomTom<TomTomSearchResponse>(url);
    if (status < 200 || status >= 300 || !Array.isArray(body?.results)) {
      throw new BadGatewayException('TomTom không trả về kết quả tìm kiếm hợp lệ. Hãy thử lại.');
    }

    const suggestions = new Map<string, PlaceSuggestionDto>();
    for (const result of body.results) {
      const id = text(result?.id);
      const address = text(result?.address?.freeformAddress);
      const label = text(result?.poi?.name) || address;
      const position = [result?.position?.lat, result?.position?.lon];
      if (!id || !label || !isLatLon(position) || suggestions.has(id)) continue;
      const [lat, lon] = position;
      suggestions.set(id, { id, label, address, lat, lon });
      if (suggestions.size === SEARCH_LIMIT) break;
    }
    return [...suggestions.values()];
  }

  private async requestTomTom<T extends object>(url: URL): Promise<{ status: number; body: T | null }> {
    const apiKey = this.config.get<string>('TOMTOM_API_KEY')?.trim();
    if (!apiKey || apiKey === 'your_tomtom_api_key') {
      throw new ServiceUnavailableException('Máy chủ chưa cấu hình khóa TOMTOM_API_KEY.');
    }
    url.searchParams.set('key', apiKey);

    const signal = AbortSignal.timeout(TOMTOM_TIMEOUT_MS);
    let response: Response;
    let body: unknown;
    try {
      response = await fetch(url, { signal, redirect: 'error' });
      body = await response.json().catch((error: unknown) => {
        if (error instanceof SyntaxError) return null;
        throw error;
      }) as unknown;
    } catch {
      if (signal.aborted) throw new GatewayTimeoutException('TomTom phản hồi quá chậm. Hãy thử lại.');
      throw new BadGatewayException('Không kết nối được với TomTom. Hãy thử lại.');
    }

    const { status } = response;
    if (status === 401 || status === 403) {
      throw new BadGatewayException('TomTom từ chối khóa API của máy chủ.');
    }
    if (status === 429 || status === 503) {
      throw new ServiceUnavailableException('TomTom đang tạm thời không khả dụng. Hãy thử lại sau.');
    }
    return { status, body: body && typeof body === 'object' && !Array.isArray(body) ? body as T : null };
  }
}
