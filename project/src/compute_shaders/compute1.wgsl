@binding(0) @group(0) var<storage, read> size: vec2<u32>;
@binding(1) @group(0) var<storage, read> current: array<u32>;
@binding(2) @group(0) var<storage, read_write> next: array<u32>;

override blockSize = 8;

fn getIndex(x: u32, y: u32) -> u32 {
  let h = size.y;
  let w = size.x;

  return (y % h) * w + (x % w);
}


fn getCoordinates(index: u32) -> vec2<u32> {
    let h : u32 = size.y;
    let w : u32 = size.x;
    
    let y : u32 = index / w;
    let x : u32 = index % w;
    
    return vec2<u32>(x, y);
}

fn getCell(x: u32, y: u32) -> u32 {
  return current[getIndex(x, y)];
}

fn countNeighbors(x: u32, y: u32) -> u32 {
  return getCell(x - 1, y - 1) + getCell(x, y - 1) + getCell(x + 1, y - 1) + 
         getCell(x - 1, y) +                         getCell(x + 1, y) + 
         getCell(x - 1, y + 1) + getCell(x, y + 1) + getCell(x + 1, y + 1);
}

@compute @workgroup_size(blockSize, blockSize)
fn main(@builtin(global_invocation_id) grid: vec3<u32>) {

  let index2D: vec2<u32>= getCoordinates( grid.x);

  if(grid.x>size.x*size.y) {
    return;
  }

  let n = countNeighbors(index2D.x, index2D.y);
  next[getIndex(index2D.x, index2D.y)] = select(u32(n == 3u), u32(n == 2u || n == 3u), getCell(index2D.x, index2D.y) == 1u); 
} 
