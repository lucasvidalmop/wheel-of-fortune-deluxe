update public.bolao_configs
set bracket_template = '[
  {"slot":0,"a":"1A","b":"3C"},
  {"slot":1,"a":"2D","b":"2F"},
  {"slot":2,"a":"1G","b":"3E"},
  {"slot":3,"a":"2B","b":"2H"},
  {"slot":4,"a":"1I","b":"3B"},
  {"slot":5,"a":"2K","b":"2J"},
  {"slot":6,"a":"1C","b":"3A"},
  {"slot":7,"a":"1L","b":"2E"},
  {"slot":8,"a":"1B","b":"3F"},
  {"slot":9,"a":"2A","b":"2C"},
  {"slot":10,"a":"1H","b":"3D"},
  {"slot":11,"a":"2I","b":"2G"},
  {"slot":12,"a":"1F","b":"3H"},
  {"slot":13,"a":"1J","b":"2L"},
  {"slot":14,"a":"1D","b":"3G"},
  {"slot":15,"a":"1E","b":"1K"}
]'::jsonb
where tag='bsb';