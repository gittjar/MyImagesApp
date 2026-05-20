require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const mongoose = require('mongoose');
const Image = require('../src/models/Image');

const reverseGeocode = async (lat, lon) => {
  const key = process.env.GOOGLE_GEOCODING_KEY;
  if (!key) return null;
  try {
    const url = `https://maps.googleapis.com/maps/api/geocode/json?latlng=${lat},${lon}&key=${key}&language=fi&result_type=locality|administrative_area_level_1|country`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.status !== 'OK' || !data.results?.length) return null;
    const comps = data.results[0].address_components;
    const locality = comps.find(c => c.types.includes('locality'))?.long_name;
    const area = comps.find(c => c.types.includes('administrative_area_level_1'))?.long_name;
    const country = comps.find(c => c.types.includes('country'))?.long_name;
    const parts = [locality || area, country].filter(Boolean);
    return parts.length ? parts.join(', ') : null;
  } catch (e) {
    console.warn('[Geocoding error]', e.message);
    return null;
  }
};

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

(async () => {
  await mongoose.connect(process.env.MONGODB_URI);
  console.log('Connected to MongoDB');

  const images = await Image.find({
    'exif.latitude': { $exists: true },
    'exif.locationName': { $exists: false }
  });

  console.log(`Found ${images.length} images to geocode`);

  let ok = 0, fail = 0;
  for (const img of images) {
    const name = await reverseGeocode(img.exif.latitude, img.exif.longitude);
    if (name) {
      await Image.updateOne({ _id: img._id }, { $set: { 'exif.locationName': name } });
      console.log(`  ✓ ${img.originalName} → ${name}`);
      ok++;
    } else {
      console.log(`  ✗ ${img.originalName} — no result`);
      fail++;
    }
    // Respect API rate limit (~50 req/s, stay safe at 10/s)
    await sleep(100);
  }

  console.log(`\nDone: ${ok} updated, ${fail} failed`);
  await mongoose.disconnect();
})();
