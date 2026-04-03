const { AIAssistant } = require('../dist/AIAssistant.js');

async function main() {
  const assistant = new AIAssistant();

  const tests = [
    'افتح كروم',
    'ابحث عن تعلم بايثون',
    '1',
    'أطفئ الجهاز',
    'نعم',
    'كل يوم الصبح افتح كروم',
    'نعم',
    'أوقف المهام'
  ];

  for (const t of tests) {
    const res = await assistant.processInput(t);
    console.log(`\n👤 ${t}`);
    console.log(`🤖 ${res.response}`);
    if (res.suggestedActions?.length) console.log(`💡 ${res.suggestedActions.join(' | ')}`);
  }

  console.log('\n✅ Smoke tests finished');
}

main().catch(err => {
  console.error('Smoke test failed:', err);
  process.exit(1);
});

