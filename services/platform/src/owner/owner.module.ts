import { Global, Module } from '@nestjs/common';
import { ConvertToCustomerService } from './convert-to-customer.service';
import { OwnerLookup } from './owner-lookup.service';

@Global()
@Module({
  providers: [OwnerLookup, ConvertToCustomerService],
  exports: [OwnerLookup, ConvertToCustomerService],
})
export class OwnerModule {}
