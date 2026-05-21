import LZString from 'lz-string';

const sel = [
  { e: '550e8400-e29b-41d4-a716-446655440000', o: '660e8400-e29b-41d4-a716-446655440001' },
  { e: '770e8400-e29b-41d4-a716-446655440002', o: '880e8400-e29b-41d4-a716-446655440003' },
  { e: '990e8400-e29b-41d4-a716-446655440004', o: 'aa0e8400-e29b-41d4-a716-446655440005' },
  { e: 'bb0e8400-e29b-41d4-a716-446655440006', o: 'cc0e8400-e29b-41d4-a716-446655440007' },
  { e: 'dd0e8400-e29b-41d4-a716-446655440008', o: 'ee0e8400-e29b-41d4-a716-446655440009' },
];

const encode = (s: typeof sel) => {
  const events = [...new Set(s.map(x => x.e))];
  const outcomes = [...new Set(s.map(x => x.o))];
  const eMap = new Map(events.map((e, i) => [e, i]));
  const oMap = new Map(outcomes.map((o, i) => [o, i]));
  const pairs = s.map(x => eMap.get(x.e) + ',' + oMap.get(x.o)).join(';');
  const payload = events.join('|') + '~' + outcomes.join('|') + '~' + pairs;
  return 'z' + LZString.compressToEncodedURIComponent(payload);
};

const compact = sel.map(s => s.e + '|' + s.o).join(';');
const neuCompact = 'z' + LZString.compressToEncodedURIComponent(compact);
const neuDict = encode(sel);

console.log('Compact:', neuCompact.length, neuCompact);
console.log('Dict:', neuDict.length, neuDict);

// Also test with repeated event (same event, different outcomes)
const sel2 = [
  { e: '550e8400-e29b-41d4-a716-446655440000', o: '660e8400-e29b-41d4-a716-446655440001' },
  { e: '550e8400-e29b-41d4-a716-446655440000', o: '880e8400-e29b-41d4-a716-446655440003' },
  { e: '550e8400-e29b-41d4-a716-446655440000', o: 'aa0e8400-e29b-41d4-a716-446655440005' },
  { e: 'bb0e8400-e29b-41d4-a716-446655440006', o: 'cc0e8400-e29b-41d4-a716-446655440007' },
  { e: 'bb0e8400-e29b-41d4-a716-446655440006', o: 'ee0e8400-e29b-41d4-a716-446655440009' },
];
console.log('Repeated compact:', ('z' + LZString.compressToEncodedURIComponent(sel2.map(s => s.e + '|' + s.o).join(';'))).length);
console.log('Repeated dict:', encode(sel2).length);
