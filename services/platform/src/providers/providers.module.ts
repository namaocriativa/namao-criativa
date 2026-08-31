import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { InstagramModule } from '../instagram/instagram.module';
import { LEAD_PROVIDERS } from './provider.interface';
import { GoogleProvider } from './google/google.provider';
import { WebsiteProvider } from './website/website.provider';
import { InstagramProvider } from './instagram/instagram.provider';
import { FacebookProvider } from './facebook/facebook.provider';
import { LinkedInProvider } from './linkedin/linkedin.provider';
import { SearchProvider } from './search/search.provider';
import { Crawl4aiClient } from './crawl4ai/crawl4ai.client';
import { Crawl4aiProvider } from './crawl4ai/crawl4ai.provider';
import { WebsiteFinderService } from './website-finder/website-finder.service';

@Module({
  imports: [ConfigModule, InstagramModule],
  providers: [
    GoogleProvider,
    Crawl4aiClient,
    Crawl4aiProvider,
    WebsiteProvider,
    InstagramProvider,
    FacebookProvider,
    LinkedInProvider,
    SearchProvider,
    WebsiteFinderService,
    {
      provide: LEAD_PROVIDERS,
      useFactory: (
        google: GoogleProvider,
        crawl4ai: Crawl4aiProvider,
        website: WebsiteProvider,
        instagram: InstagramProvider,
        facebook: FacebookProvider,
        linkedin: LinkedInProvider,
        search: SearchProvider,
      ) => [google, crawl4ai, website, search, instagram, facebook, linkedin],
      inject: [
        GoogleProvider,
        Crawl4aiProvider,
        WebsiteProvider,
        InstagramProvider,
        FacebookProvider,
        LinkedInProvider,
        SearchProvider,
      ],
    },
  ],
  exports: [
    LEAD_PROVIDERS,
    GoogleProvider,
    Crawl4aiProvider,
    WebsiteProvider,
    InstagramProvider,
    FacebookProvider,
    LinkedInProvider,
    SearchProvider,
    WebsiteFinderService,
  ],
})
export class ProvidersModule {}
