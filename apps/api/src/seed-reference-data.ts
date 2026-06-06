import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { Repository } from 'typeorm';
import { FilamentBrand } from './filament/brand.entity';
import { FilamentType } from './filament/filament-type.entity';
import { FilamentOption } from './filament/filament-option.entity';
import { getRepositoryToken } from '@nestjs/typeorm';

async function bootstrap() {
  const app = await NestFactory.createApplicationContext(AppModule);

  const brandRepository = app.get<Repository<FilamentBrand>>(
    getRepositoryToken(FilamentBrand),
  );
  const typeRepository = app.get<Repository<FilamentType>>(
    getRepositoryToken(FilamentType),
  );
  const optionRepository = app.get<Repository<FilamentOption>>(
    getRepositoryToken(FilamentOption),
  );

  try {
    console.log('🚀 Seeding reference data...\n');

    // Seed Brands
    const brands = [
      'Prusament',
      'Sunlu',
      'Bambu Lab',
      'Polymaker',
      'eSun',
      'Overture',
      'Hatchbox',
      'ColorFabb',
      'MatterHackers',
    ];

    for (const name of brands) {
      const existing = await brandRepository.findOne({ where: { name } });
      if (!existing) {
        await brandRepository.save({ name, isCustom: false });
        console.log(`✅ Brand: ${name}`);
      }
    }

    // Seed Filament Types
    const types = [
      {
        name: 'PLA',
        description: 'Polylactic Acid - Easy to print, biodegradable',
      },
      {
        name: 'PETG',
        description: 'Polyethylene Terephthalate Glycol - Strong and durable',
      },
      {
        name: 'ABS',
        description: 'Acrylonitrile Butadiene Styrene - Heat resistant',
      },
      { name: 'TPU', description: 'Thermoplastic Polyurethane - Flexible' },
      {
        name: 'ASA',
        description: 'Acrylonitrile Styrene Acrylate - UV resistant',
      },
      { name: 'Nylon', description: 'Strong and flexible' },
      { name: 'PC', description: 'Polycarbonate - Very strong' },
      {
        name: 'HIPS',
        description: 'High Impact Polystyrene - Support material',
      },
      { name: 'PVA', description: 'Polyvinyl Alcohol - Water soluble support' },
    ];

    for (const type of types) {
      const existing = await typeRepository.findOne({
        where: { name: type.name },
      });
      if (!existing) {
        await typeRepository.save(type);
        console.log(`✅ Type: ${type.name}`);
      }
    }

    // Seed Filament Options
    const options = [
      // Finish
      {
        name: 'Matte',
        category: 'finish',
        description: 'Non-reflective surface finish',
        isCharacteristic: true,
      },
      {
        name: 'Glossy',
        category: 'finish',
        description: 'Shiny surface finish',
        isCharacteristic: true,
      },
      {
        name: 'Satin',
        category: 'finish',
        description: 'Semi-gloss finish',
        isCharacteristic: true,
      },

      // Effect
      {
        name: 'Wood',
        category: 'effect',
        description: 'Wood-filled filament',
        isCharacteristic: true,
      },
      {
        name: 'Marble',
        category: 'effect',
        description: 'Marble-like appearance',
        isCharacteristic: true,
      },
      {
        name: 'Silk',
        category: 'effect',
        description: 'Silky smooth finish',
        isCharacteristic: true,
      },
      {
        name: 'Metallic',
        category: 'effect',
        description: 'Metallic sheen',
        isCharacteristic: true,
      },
      {
        name: 'Carbon Fiber',
        category: 'effect',
        description: 'Carbon fiber reinforced',
        isCharacteristic: true,
      },
      {
        name: 'Sparkle',
        category: 'effect',
        description: 'Glitter/sparkle effect',
        isCharacteristic: true,
      },

      // Special
      {
        name: 'Glow in Dark',
        category: 'special',
        description: 'Phosphorescent',
        isCharacteristic: false,
      },
      {
        name: 'UV Reactive',
        category: 'special',
        description: 'Glows under UV light',
        isCharacteristic: false,
      },
      {
        name: 'Temperature Sensitive',
        category: 'special',
        description: 'Changes color with temperature',
        isCharacteristic: false,
      },
      {
        name: 'Conductive',
        category: 'special',
        description: 'Electrically conductive',
        isCharacteristic: false,
      },
    ];

    for (const option of options) {
      const existing = await optionRepository.findOne({
        where: { name: option.name, category: option.category },
      });
      if (!existing) {
        await optionRepository.save(option);
        console.log(`✅ Option: ${option.name} (${option.category})`);
      }
    }

    console.log('\n🎉 Reference data seeded successfully!');
    console.log(`\n📊 Summary:`);
    console.log(`   - ${await brandRepository.count()} brands`);
    console.log(`   - ${await typeRepository.count()} types`);
    console.log(`   - ${await optionRepository.count()} options`);
  } catch (error) {
    console.error('❌ Seed failed:', error);
    process.exit(1);
  } finally {
    await app.close();
  }
}

bootstrap();
