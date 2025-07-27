import mongoose from 'mongoose'; 
import { DB } from '../db';

async function runMigration() {
  try {
    await DB.connect();
    console.log('Connected to database');

    // Ensure mongoose.connection.db is defined
    if (!mongoose.connection.db) {
      throw new Error('Database connection is not established.');
    }

    // Update normalizedProductName
    const adminProducts = await mongoose.connection.db.collection('adminproducts').find().toArray();
    for (const doc of adminProducts) {
      const normalizedName = doc.productName
        .toLowerCase()
        .replace(/[^a-z]/g, '')
        .replace(/(.)\1+/g, '$1')
        .trim();
      await mongoose.connection.db!.collection('adminproducts').updateOne(
        { _id: doc._id },
        { $set: { normalizedProductName: normalizedName } }
      );
    }
    // Populate colors and sizes
    const adminProductsForColors = await mongoose.connection.db.collection('adminproducts').find().toArray();
    for (const doc of adminProductsForColors) {
      if (doc.color) {
        await mongoose.connection.db!.collection('colors').updateOne(
          { name: doc.color },
          { $set: { name: doc.color } },
          { upsert: true }
        );
      }
      await mongoose.connection.db!.collection('sizes').updateOne(
        { name: doc.size },
        { $set: { name: doc.size } },
        { upsert: true }
      );
    }

    // Remove duplicates
    const duplicates = await mongoose.connection.db.collection('adminproducts').aggregate([
      { $group: { _id: "$normalizedProductName", count: { $sum: 1 }, docs: { $push: "$_id" } } },
      { $match: { count: { $gt: 1 } } }
    ]).toArray();
    for (const doc of duplicates) {
      const idsToDelete = doc.docs.slice(1);
      await mongoose.connection.db.collection('adminproducts').deleteMany({ _id: { $in: idsToDelete } });
    }

    // Recreate indexes
    await mongoose.connection.db.collection('adminproducts').dropIndexes();
    await mongoose.connection.db.collection('adminproducts').createIndex({ normalizedProductName: 1 }, { unique: true });
    await mongoose.connection.db.collection('adminproducts').createIndex({ productCode: 1 }, { unique: true });

    console.log('Migration completed');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

runMigration();