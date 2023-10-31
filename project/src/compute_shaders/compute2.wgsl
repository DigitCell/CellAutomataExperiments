
struct CellInfo {
    value :  f32,
    status : f32,
    angle :  f32,
    directionX : f32,
    directionY : f32,
};

struct CellyUniforms {
    k1:  f32,
    k2:  f32,

    k3:  f32,

    k31:  f32,
    k32:  f32,
    k33:  f32,

    status_max:  f32,
    status_border:  f32,

    angle_div:  f32,
    dist_1:  f32,
    dist_2:  f32,
};


alias CellDataBuffer = array<CellInfo>;

@binding(0) @group(0) var<storage, read> size: vec2<u32>;
@binding(1) @group(0) var<storage, read> current: CellDataBuffer;
@binding(2) @group(0) var<storage, read_write> next: CellDataBuffer;
@binding(3) @group(0) var<storage, read_write> drawBuffer: array<f32>;
@binding(4) @group(0) var<storage, read_write> params: CellyUniforms;

override blockSize = 32;

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

fn getCell(x: u32, y: u32) -> f32 {
  return current[getIndex(x, y)].value;
}

fn getCellVec(v:vec2<u32>) -> f32 {
  return current[getIndex(v.x, v.y)].value;
}

fn getCellVecIndex(v:vec2<u32>) -> u32 {
  return getIndex(v.x, v.y);
}

fn countNeighbors(x: u32, y: u32) -> f32 {
  return getCell(x - 1, y - 1) + getCell(x, y - 1) + getCell(x + 1, y - 1) + 
         getCell(x - 1, y) +                         getCell(x + 1, y) + 
         getCell(x - 1, y + 1) + getCell(x, y + 1) + getCell(x + 1, y + 1);
}


fn mapPosCorrection(i: u32, j: u32, NX: u32, NY: u32) -> vec2<u32> {
    return vec2<u32>(
       // clamp(i, 0, NX - 1),
       // clamp(j, 0, NY - 1)

        (i + NX) % NX,  // Wrap i around if it goes out of bounds
        (j + NY) % NY   // Wrap j around if it goes out of bounds
    );
}

// Define constants for the LCG algorithm
const  A:u32 = 1664525u;
const  C:u32 = 1013904223u;
const  M:u32 = 2^32;//4294967296u; // 2^32

// Define the seed value
 // You can choose any non-zero value

// Custom pseudo-random number generator function
fn random() -> f32 {
  var seed:u32 = 12345u;
    seed = (A * seed + C) % M;
    return f32(seed) / f32(M);
}


fn randomFloat(min: f32, max: f32) -> f32 {
    return min + (max - min) * random();
}

fn vecFromAngle(a: f32) -> vec2<f32> {
    return vec2<f32>(cos(a), sin(a));
}

fn intVecFromAngle(a: f32, dist: f32) -> vec2<f32> {
    return vec2<f32>(f32(cos(a) * f32(dist)), f32(sin(a) * f32(dist)));
}


fn diffuse(indexX: u32, indexY: u32, NX: u32, NY: u32) {
    let P : vec2<u32> = mapPosCorrection(indexX, indexY, NX, NY);
    let N : vec2<u32> = mapPosCorrection(P.x, P.y + 1, NX, NY);
    let S : vec2<u32> = mapPosCorrection(P.x, P.y - 1, NX, NY);
    let E : vec2<u32> = mapPosCorrection(P.x + 1, P.y, NX, NY);
    let W : vec2<u32> = mapPosCorrection(P.x - 1, P.y, NX, NY);

    let NE : vec2<u32> = mapPosCorrection(P.x + 1, P.y + 1, NX, NY);
    let SW : vec2<u32> = mapPosCorrection(P.x - 1, P.y - 1, NX, NY);
    let EN : vec2<u32> = mapPosCorrection(P.x + 1, P.y - 1, NX, NY);
    let WS : vec2<u32> = mapPosCorrection(P.x - 1, P.y + 1, NX, NY);

    let result:f32 =  (getCell(E.x, E.y) + getCell(W.x, W.y) + getCell(N.x, N.y) + getCell(S.x, S.y) +
                              getCell(NE.x, NE.y) + getCell(SW.x, SW.y) + getCell(EN.x, EN.y) + getCell(WS.x, WS.y));

    let k : f32 = result / 8.0;

    
    let M_PI:f32=3.141592;
    let deltaPlus = randomFloat(0.0, 10.0) * M_PI / params.angle_div;

    let PCoord =  mapPosCorrection(indexX, indexY, NX, NY);
    let PIndex: u32=getIndex(PCoord.x, PCoord.y);

    next[PIndex].status = current[PIndex].status + 0.5*randomFloat(0.0,1.0);

    var angle:f32 = current[PIndex].angle;

    if (current[PIndex].status > params.status_border) {
        let genNumber = randomFloat(0.0, 100.0);
        if (genNumber > 50.0) {
            angle = current[PIndex].angle + deltaPlus;
        }
        next[PIndex].status = randomFloat(0.0, params.status_border - 5.0);
    }

    var directionT =  intVecFromAngle(angle, randomFloat(0.0, params.dist_1));
    var directionT2 = intVecFromAngle(angle, randomFloat(0.0, params.dist_2));

    next[PIndex].angle = angle;
    next[PIndex].directionX = directionT.x;
    next[PIndex].directionY = directionT.y;

    let P2Coord =mapPosCorrection(u32(f32(indexX) + directionT.x),u32( f32(indexY) + directionT.y), NX, NY);
    let P2: f32 = current[getCellVecIndex(P2Coord)].value;

    let P3Coord =mapPosCorrection(u32(f32(indexX) + directionT2.x),u32( f32(indexY) + directionT2.y), NX, NY);
    let P3: f32 = current[getCellVecIndex(P3Coord)].value;

    if (k > params.k1){
        next[PIndex].value = k * params.k2;
    }
    else if (k > params.k3){
        next[PIndex].value = (params.k31 * k + params.k32 * P2 + params.k33 * P3);
    }
    else{
        next[PIndex].value = k * 0.15;
    }

    if (next[PIndex].status > params.status_max){
        next[PIndex].status = randomFloat(0.0, params.status_border / 2.0);
    }

    if (next[PIndex].value > 1.0){
        next[PIndex].value = 1.0;
    }

    if (next[PIndex].value < 0.00011) {
        next[PIndex].value = 0.00011;
    }

    //    next[getIndex(indexX, indexY)].value=k;
    drawBuffer[PIndex]= next[PIndex].value;


}



@compute @workgroup_size(blockSize, blockSize)
fn main(@builtin(global_invocation_id) grid: vec3<u32>) {

  let index2D: vec2<u32>= getCoordinates( grid.x);

  if(grid.x>size.x*size.y) {
    return;
  }

  diffuse(index2D.x, index2D.y, size.x, size.y);

} 
