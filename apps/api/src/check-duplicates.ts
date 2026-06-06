import { DataSource } from 'typeorm';
import { User } from './auth/user.entity';
import { AppDataSource } from './data-source';

async function checkDuplicates() {
  try {
    await AppDataSource.initialize();
    console.log('Connexion établie.');

    const duplicates = await AppDataSource.getRepository(User)
      .createQueryBuilder('user')
      .select('user.email', 'email')
      .addSelect('COUNT(user.id)', 'count')
      .groupBy('user.email')
      .having('COUNT(user.id) > 1')
      .getRawMany();

    if (duplicates.length === 0) {
      console.log('✅ Aucun doublon detecté. Tous les emails sont uniques.');
    } else {
      console.log(`⚠️  ${duplicates.length} emails en double détectés :`);
      for (const dup of duplicates) {
        const users = await AppDataSource.getRepository(User).find({
          where: { email: dup.email },
          select: ['id', 'username', 'googleId', 'appleId', 'createdAt']
        });
        console.log(`- ${dup.email} (${dup.count} comptes) :`);
        users.forEach(u => console.log(`    [ID: ${u.id}] ${u.username} - Créé le: ${u.createdAt} ${u.googleId ? '(Google)' : ''} ${u.appleId ? '(Apple)' : ''}`));
      }
    }

    await AppDataSource.destroy();
  } catch (error) {
    console.error('Erreur lors du diagnostic :', error);
    process.exit(1);
  }
}

checkDuplicates();
