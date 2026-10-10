import {
  Body,
  Controller,
  Delete,
  Get,
  NotFoundException,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  Query,
  UseGuards,
} from '@nestjs/common';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import type { CurrentUser as CurrentUserContext } from '../users/user.types';
import {
  CreatePostDto,
  CreatePostCommentDto,
  ListPostsQueryDto,
  UpdatePostDto,
  UpdatePostTagsDto,
  UpdatePostVisibilityDto,
} from './dto/post.dto';
import type { DeletedPostView, PostPage, PostView } from './post.types';
import { POST_NOT_FOUND_MESSAGE, PostsService } from './posts.service';

const postIdPipe = new ParseUUIDPipe({
  exceptionFactory: () => new NotFoundException(POST_NOT_FOUND_MESSAGE),
});

@Controller()
@UseGuards(JwtAuthGuard)
export class PostsController {
  constructor(private readonly postsService: PostsService) {}

  @Get('posts/:postId/comments')
  comments(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('postId', postIdPipe) postId: string,
    @Query() query: ListPostsQueryDto,
  ) {
    return this.postsService.listComments(viewer.id, postId, query);
  }

  @Post('posts/:postId/comments')
  comment(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('postId', postIdPipe) postId: string,
    @Body() dto: CreatePostCommentDto,
  ) {
    return this.postsService.addComment(viewer.id, postId, dto.content);
  }

  @Delete('posts/:postId/comments/:commentId')
  deleteComment(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('postId', postIdPipe) postId: string,
    @Param('commentId', postIdPipe) commentId: string,
  ) {
    return this.postsService.deleteComment(viewer.id, postId, commentId);
  }

  @Post('posts/:postId/shares')
  share(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('postId', postIdPipe) postId: string,
  ) {
    return this.postsService.share(viewer.id, postId);
  }

  @Post('posts')
  create(
    @CurrentUser() viewer: CurrentUserContext,
    @Body() dto: CreatePostDto,
  ): Promise<PostView> {
    return this.postsService.create(viewer.id, dto);
  }

  @Get('posts')
  listFeed(
    @CurrentUser() viewer: CurrentUserContext,
    @Query() query: ListPostsQueryDto,
  ): Promise<PostPage> {
    return this.postsService.listFeed(viewer.id, query);
  }

  @Get('posts/:postId')
  findOne(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('postId', postIdPipe) postId: string,
  ): Promise<PostView> {
    return this.postsService.findVisible(viewer.id, postId);
  }

  @Patch('posts/:postId')
  update(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('postId', postIdPipe) postId: string,
    @Body() dto: UpdatePostDto,
  ): Promise<PostView> {
    return this.postsService.update(viewer.id, postId, dto);
  }

  @Put('posts/:postId/like')
  like(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('postId', postIdPipe) postId: string,
  ): Promise<PostView> {
    return this.postsService.setLike(viewer.id, postId, true);
  }

  @Delete('posts/:postId/like')
  unlike(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('postId', postIdPipe) postId: string,
  ): Promise<PostView> {
    return this.postsService.setLike(viewer.id, postId, false);
  }

  @Delete('posts/:postId')
  remove(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('postId', postIdPipe) postId: string,
  ): Promise<DeletedPostView> {
    return this.postsService.remove(viewer.id, postId);
  }

  @Patch('posts/:postId/visibility')
  updateVisibility(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('postId', postIdPipe) postId: string,
    @Body() dto: UpdatePostVisibilityDto,
  ): Promise<PostView> {
    return this.postsService.updateVisibility(viewer.id, postId, dto);
  }

  @Put('posts/:postId/tags')
  updateTags(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('postId', postIdPipe) postId: string,
    @Body() dto: UpdatePostTagsDto,
  ): Promise<PostView> {
    return this.postsService.updateTags(viewer.id, postId, dto);
  }

  @Get('users/:username/posts')
  listByAuthor(
    @CurrentUser() viewer: CurrentUserContext,
    @Param('username') username: string,
    @Query() query: ListPostsQueryDto,
  ): Promise<PostPage> {
    return this.postsService.listByAuthor(viewer.id, username, query);
  }
}
