import LZString from 'lz-string';

const sel = [
  { e: '550e8400-e29b-41d4-a716-446655440000', o: '660e8400-e29b-41d4-a716-446655440001' },
  { e: '770e8400-e29b-41d4-a716-446655440002', o: '880e8400-e29b-41d4-a716-446655440003' },
  { e: '990e8400-e29b-41d4-a716-446655440004', o: 'aa0e8400-e29b-41d4-a716-446655440005' },
];

const old = btoa(JSON.stringify({ s: sel })).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const neu = 'z' + LZString.compressToEncodedURIComponent(JSON.stringify({ s: sel }));

console.log('Old length:', old.length, old);
console.log('New length:', neu.length, neu);
