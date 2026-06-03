const fs = require('fs');
const { SourceMapConsumer } = require('source-map');
const raw = fs.readFileSync('dist/assets/index-DBp_7_lA.js.map', 'utf8');
const parsed = JSON.parse(raw);
SourceMapConsumer.with(parsed, null, (consumer) => {
  const pos = consumer.originalPositionFor({ line: 5876, column: 21542 });
  console.log(JSON.stringify(pos, null, 2));
});
