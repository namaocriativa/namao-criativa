import { Controller, Get, Query } from '@nestjs/common';
import { LocationsService } from './locations.service';
import { StudioAuth } from '../auth/studio-auth.decorator';

@StudioAuth()
@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Get('cities')
  searchCities(
    @Query('q') q = '',
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? Number(limit) : 10;
    return this.locationsService.searchCities(
      q,
      Number.isFinite(parsedLimit) ? parsedLimit : 10,
    );
  }

  @Get('neighborhoods')
  searchNeighborhoods(
    @Query('city') city = '',
    @Query('state') state = '',
    @Query('q') q = '',
    @Query('limit') limit?: string,
  ) {
    const parsedLimit = limit ? Number(limit) : 8;
    return this.locationsService.searchNeighborhoods(
      city,
      state,
      q,
      Number.isFinite(parsedLimit) ? parsedLimit : 8,
    );
  }
}
