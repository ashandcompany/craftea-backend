import 'dotenv/config';
import { DataSource } from 'typeorm';
import { Category } from '../categories/entities/category.entity';
import { Product } from '../products/entities/product.entity';
import { ProductImage } from '../products/entities/product-image.entity';
import { Tag } from '../tags/entities/tag.entity';

const AppDataSource = new DataSource({
  type: 'postgres',
  url: process.env.DATABASE_URL,
  entities: [Category, Product, ProductImage, Tag],
  synchronize: false,
});

async function seed() {
  await AppDataSource.initialize();

  const repo = AppDataSource.getRepository(Category);

  const categories = [
    {
      name: 'Bijoux',
      description:
        'Créations artisanales : colliers, bagues, bracelets faits main.',
      icon: 'Diamond',
    },
    {
      name: 'Vêtements',
      description: 'Mode artisanale, vêtements uniques et personnalisés.',
      icon: 'Tshirt',
    },
    {
      name: 'Décoration',
      description: 'Objets décoratifs pour la maison faits main.',
      icon: 'Home',
    },
    {
      name: 'Art & Illustrations',
      description: 'Peintures, dessins, affiches et œuvres originales.',
      icon: 'Palette',
    },
    {
      name: 'Papeterie',
      description: 'Carnets, cartes, stickers et fournitures créatives.',
      icon: 'Notebook',
    },
  ];

  await repo.save(categories);

  console.log('✅ Categories seeded');
  await AppDataSource.destroy();
}

seed();
