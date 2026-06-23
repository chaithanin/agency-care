import { Body, Controller, Delete, Get, Param, Patch, Post } from '@nestjs/common';
import {
  ProductService,
  CreateProductDto,
  UpdateProductDto,
} from './product.service';
import { Roles } from '../auth/guards';

@Controller('products')
export class ProductController {
  constructor(private service: ProductService) {}

  @Get()
  list() {
    return this.service.list();
  }

  @Roles('admin', 'closer')
  @Post()
  create(@Body() dto: CreateProductDto) {
    return this.service.create(dto);
  }

  @Roles('admin', 'closer')
  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateProductDto) {
    return this.service.update(id, dto);
  }

  @Roles('admin', 'closer')
  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
