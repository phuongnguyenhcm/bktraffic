import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString } from 'class-validator';

export class SearchPlaceQueryDto {
  @Transform(({ value }: { value: unknown }) => typeof value === 'string' ? value.trim() : value)
  @IsString({ message: 'Từ khóa tìm kiếm (q) phải là chuỗi.' })
  @IsNotEmpty({ message: 'Hãy nhập tên đường hoặc địa điểm cần tìm.' })
  q: string;
}

export interface PlaceSuggestionDto {
  id: string;
  label: string;
  address: string;
  lat: number;
  lon: number;
}
