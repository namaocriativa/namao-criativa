import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CurrentUser } from '../auth/current-user.decorator';
import type { JwtUser } from '../auth/identity';
import { StudioAuth } from '../auth/studio-auth.decorator';
import { CreativeAgentService } from './creative-agent.service';
import type { CreativeAgentKind } from './agent.constants';
import {
  CreateCreativeConversationDto,
  CreateCreativeTurnDto,
  ExecuteCreativeToolDto,
} from './dto/creative-agent.dto';
import { UpdateCreativeProposalDto } from './dto/update-proposal.dto';

@StudioAuth()
@Controller('creative/llm')
export class CreativeAgentController {
  constructor(private readonly agent: CreativeAgentService) {}

  @Get('tools')
  listTools(
    @Query('kind') kind: CreativeAgentKind,
    @CurrentUser() user: JwtUser,
  ) {
    return this.agent.catalog(parseKind(kind), user);
  }

  @Post('tools/:name')
  executeTool(
    @Param('name') name: string,
    @Body() dto: ExecuteCreativeToolDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.agent.executeTool(name, dto, user);
  }

  @Get('conversations')
  listConversations(
    @Query('kind') kind: CreativeAgentKind,
    @CurrentUser() user: JwtUser,
  ) {
    return this.agent.listConversations(parseKind(kind), user);
  }

  @Post('conversations')
  createConversation(
    @Body() dto: CreateCreativeConversationDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.agent.createConversation(dto.kind, user, dto.name);
  }

  @Post('turns')
  turn(@Body() dto: CreateCreativeTurnDto, @CurrentUser() user: JwtUser) {
    return this.agent.turn(dto, user);
  }

  @Post('conversations/:id/turns')
  turnOnConversation(
    @Param('id') id: string,
    @Body() dto: CreateCreativeTurnDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.agent.turn({ ...dto, conversationId: id }, user);
  }

  @Patch('conversations/:id/proposals/:proposalId')
  updateProposal(
    @Param('id') id: string,
    @Param('proposalId') proposalId: string,
    @Body() dto: UpdateCreativeProposalDto,
    @CurrentUser() user: JwtUser,
  ) {
    return this.agent.updateProposal(id, proposalId, dto, user);
  }

  @Post('conversations/:id/proposals/:proposalId/confirm')
  confirmProposal(
    @Param('id') id: string,
    @Param('proposalId') proposalId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.agent.confirmProposal(id, proposalId, user);
  }

  @Post('conversations/:id/proposals/:proposalId/cancel')
  cancelProposal(
    @Param('id') id: string,
    @Param('proposalId') proposalId: string,
    @CurrentUser() user: JwtUser,
  ) {
    return this.agent.cancelProposal(id, proposalId, user);
  }
}

function parseKind(kind: string | undefined): CreativeAgentKind {
  if (kind === 'image' || kind === 'video') return kind;
  throw new BadRequestException('Informe kind=image ou kind=video');
}
