import { Mat4, mat4, Vec3, Vec2 } from 'wgpu-matrix';
import * as dat from 'dat.gui';

import vertWGSL from './shaders/vert.wgsl';
import fragWGSL from './shaders/frag.wgsl';
import computeWGSL from './compute_shaders/compute3.wgsl';



export class Graphics {
    private canvasEl: HTMLCanvasElement;
    private gui: dat.GUI;
    private device: GPUDevice;
    private context: GPUCanvasContext;
    private presentationFormat: any;
    private squareVertices: Uint32Array;
    private squareBuffer: GPUBuffer;
    private bindGroup0:GPUBindGroup;
    private bindGroup1:GPUBindGroup;
    private buffer0: GPUBuffer;
    private buffer1: GPUBuffer;
    private bufferCellDraw :GPUBuffer;
    private sizeBuffer: GPUBuffer;
    private uniformBuffer: GPUBuffer;
  
    private uniformBindGroup: GPUBindGroup;
    private bindGroupLayoutCompute:GPUBindGroupLayout;
    private renderPipeline: GPURenderPipeline;
    private computePipeline: GPUComputePipeline;
    private renderPassDescriptor: GPURenderPassDescriptor;
    private commandEncoder: GPUCommandEncoder;

    private aspect :number;
    private loopTimes:number= 0;
    private wholeTime: number = 0;
    private length:number=0;

    private GameOptions = {
      width: 128,
      height: 128,
      timestep: 1,
      workgroupSize: 8,
    };

    private CellIfo ={
      value : 0.12,
      status : 1.0,
      angle : 1.0,
      direction : [0,0],
    };

    private CellUniform= {
      k1:0.395,
      k2:0.967,
  
      k3:0.0391,
  
      k31:0.9995,
      k32:0.95,
      k33:0.9,
  
      status_max:15,
      status_border:7,
  
      angle_div:7.0,
      dist_1:3,
      dist_2:2,
  };
  

    constructor() {
       this.aspect=1.0;
       this.squareVertices = new Uint32Array([0, 0, 0, 1, 1, 0, 1, 1]);
       this.resetGameData = this.resetGameData.bind(this);
       this.resetGameDataU = this.resetGameDataU.bind(this);
    }

    private async initializeWebGPU(): Promise<boolean> {
        this.canvasEl = document.getElementById('canvas') as HTMLCanvasElement;
        if (!this.canvasEl) {
            console.error("Canvas element not found");
            return false;
        }
        //init gpuModule
        const gpuObject=  await navigator.gpu;
        if (!gpuObject) {
            throw Error("WebGPU not supported.");
            return false;
        }
        const adapter = await gpuObject.requestAdapter();
        if (!adapter) {
            throw Error("Couldn't request WebGPU adapter.");
            return false;
        }

        const gpuLimits=adapter.limits;
       // console.log(gpuLimits);
        this.device = await adapter.requestDevice();

        //configure the canvas context
        this.context = this.canvasEl.getContext('webgpu') as GPUCanvasContext;

        const devicePixelRatio = window.devicePixelRatio || 1;
        this.canvasEl.width = this.canvasEl.clientWidth * devicePixelRatio;
        this.canvasEl.height = this.canvasEl.clientHeight * devicePixelRatio;
        this.presentationFormat = navigator.gpu.getPreferredCanvasFormat();

        this.context.configure({
            device: this.device,
            format: this.presentationFormat,
            alphaMode: 'premultiplied',
        });
 
        this.gui = new dat.GUI();

        return true; // Return true if initialization succeeds
    }

    private initializeComputeBuffers(): boolean {

        this.length = this.GameOptions.width * this.GameOptions.height;
        const cells = new Float32Array(this.length);
        for (let i = 0; i < this.length; i++) {
          cells[i] = Math.random();// * 0.25;
        }

        this.bufferCellDraw = this.device.createBuffer({
          size: cells.byteLength,
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX,
          mappedAtCreation: true,
        });
        new Uint32Array(this.bufferCellDraw.getMappedRange()).set(cells);
        this.bufferCellDraw.unmap();
        
        // Assuming data is an array of objects with the same structure as MyData
        const dataArray = [];

        for (let i = 0; i < this.GameOptions.width; i++) {
            for (let j = 0; j < this.GameOptions.height; j++) {
                dataArray.push({
                    value:   Math.random(),
                    status:  Math.random(),
                    angle:   Math.random(),
                    directionX: Math.random(),
                    directionY: Math.random(),
                });
            }
        }
     
        this.buffer0 = this.device.createBuffer({
          size:  dataArray.length * 32, // Assuming 16 bytes for the structure
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST,
          mappedAtCreation: true,
        });
        //new Float32Array(this.buffer0.getMappedRange()).set(dataArray);
        
        const mappedData = new Float32Array(this.buffer0.getMappedRange());

        for (let i = 0; i < dataArray.length; i++) {
          const item = dataArray[i];
          mappedData[i * 5] =     item.value;
          mappedData[i * 5 + 1] = item.status;
          mappedData[i * 5 + 2] = item.angle;
          mappedData[i * 5 + 3] = item.directionX;
          mappedData[i * 5 + 4] = item.directionY;
        }
        
        this.buffer0.unmap();
    
        this.buffer1 = this.device.createBuffer({
          size:  dataArray.length * 32, // Assuming 16 bytes for the structure
          usage: GPUBufferUsage.STORAGE | GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_DST,
        });

        const dataArray2 =[{...this.CellUniform}];
        //dataArray2=[{...this.CellUniform}];
        this.uniformBuffer = this.device.createBuffer({
          size: 11*32, // Assuming 16 bytes for the structure
          usage:    GPUBufferUsage.STORAGE | GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_DST,
          mappedAtCreation: true,
        });
        
        const mappedData2 = new Float32Array(this.uniformBuffer.getMappedRange());
        mappedData2[0] = this.CellUniform.k1;
        mappedData2[1] = this.CellUniform.k2;
        mappedData2[2] = this.CellUniform.k3;
        mappedData2[3] = this.CellUniform.k31;
        mappedData2[4] = this.CellUniform.k32;
        mappedData2[5] = this.CellUniform.k33;

        mappedData2[6] = this.CellUniform.status_max;
        mappedData2[7] = this.CellUniform.status_border;
        mappedData2[8] = this.CellUniform.angle_div;

        mappedData2[9] = this.CellUniform.dist_1;
        mappedData2[10] = this.CellUniform.dist_2;

        this.uniformBuffer.unmap();

        return true;
    }

    private initializeComputePipline(): boolean {

        const computeShader = this.device.createShaderModule({ code: computeWGSL });
        this.bindGroupLayoutCompute = this.device.createBindGroupLayout({
          entries: [
          {
            binding: 0,
            visibility: GPUShaderStage.COMPUTE,
            buffer: {
            type: 'read-only-storage',
            },
          },
          {
            binding: 1,
            visibility: GPUShaderStage.COMPUTE,
            buffer: {
            type: 'read-only-storage',
            },
          },
          {
            binding: 2,
            visibility: GPUShaderStage.COMPUTE,
            buffer: {
            type: 'storage',
            },
          },
          {
            binding: 3,
            visibility: GPUShaderStage.COMPUTE,
            buffer: {
            type: 'storage',
            },
          },

          {
            binding: 4,
            visibility: GPUShaderStage.COMPUTE,
            buffer: {
            type: 'storage',
            },
          },
          ],
        });

        this.bindGroup0 = this.device.createBindGroup({
          layout: this.bindGroupLayoutCompute,
          entries: [
            { binding: 0, resource: { buffer: this.sizeBuffer } },
            { binding: 1, resource: { buffer: this.buffer0 } },
            { binding: 2, resource: { buffer: this.buffer1 } },
            { binding: 3, resource: { buffer: this.bufferCellDraw } },
            { binding: 4, resource: { buffer: this.uniformBuffer } },
          ],
        });
      
        this.bindGroup1 = this.device.createBindGroup({
          layout: this.bindGroupLayoutCompute,
          entries: [
            { binding: 0, resource: { buffer: this.sizeBuffer } },
            { binding: 1, resource: { buffer: this.buffer1 } },
            { binding: 2, resource: { buffer: this.buffer0 } },
            { binding: 3, resource: { buffer: this.bufferCellDraw } },
            { binding: 4, resource: { buffer: this.uniformBuffer } },
          ],
        });

        const pipelineDescriptor ={
          layout: this.device.createPipelineLayout({
            bindGroupLayouts: [this.bindGroupLayoutCompute],
          }),
          compute: {
            module: computeShader,
            entryPoint: 'main',
            constants: {
              blockSize: this.GameOptions.workgroupSize,
            },
          },
        };

        this.computePipeline = this.device.createComputePipeline(pipelineDescriptor);
        return true;
    }

    private initializeRenderBuffers(): boolean {
        this.squareBuffer = this.device.createBuffer({
            size: this.squareVertices.byteLength,
            usage: GPUBufferUsage.VERTEX,
            mappedAtCreation: true,
            });
        new Uint32Array(this.squareBuffer.getMappedRange()).set(this.squareVertices);
        this.squareBuffer.unmap();

        return true;
    }

    private initializeTextures(): boolean {
        return true;
    }

    private initializeUniformBuffers(): boolean {

        this.sizeBuffer = this.device.createBuffer({
            size: 2 * Uint32Array.BYTES_PER_ELEMENT,
            usage:
              GPUBufferUsage.STORAGE |
              GPUBufferUsage.UNIFORM |
              GPUBufferUsage.COPY_DST |
              GPUBufferUsage.VERTEX,
            mappedAtCreation: true,
          });
          new Uint32Array(this.sizeBuffer.getMappedRange()).set([
            this.GameOptions.width,
            this.GameOptions.height,
          ]);
          this.sizeBuffer.unmap();

        return true;
    }

    private initializeRenderPipline(): boolean {

        const vertexShader =   this.device.createShaderModule({ code: vertWGSL });
        const fragmentShader = this.device.createShaderModule({ code: fragWGSL });

        const squareStride: GPUVertexBufferLayout = {
          arrayStride: 2 * this.squareVertices.BYTES_PER_ELEMENT,
          stepMode: 'vertex',
          attributes: [
            {
              shaderLocation: 1,
              offset: 0,
              format: 'uint32x2',
            },
          ],
        };

        const cellsStride: GPUVertexBufferLayout = {
          arrayStride: Float32Array.BYTES_PER_ELEMENT,
          stepMode: 'instance',
          attributes: [
            {
              shaderLocation: 0,
              offset: 0,
              format: 'float32',
            },
          ],
        };

        const bindGroupLayoutRender = this.device.createBindGroupLayout({
          entries: [
            {
              binding: 0,
              visibility: GPUShaderStage.VERTEX,
              buffer: {
                type: 'uniform',
              },
            },
          ],
        });

        const pipelineDescriptor:GPURenderPipelineDescriptor = {
          layout: this.device.createPipelineLayout({
            bindGroupLayouts: [bindGroupLayoutRender],
          }),

          primitive: {
            topology: 'triangle-strip',
          },
          
          vertex: {
            module: vertexShader,
            entryPoint: 'main',
            buffers: [cellsStride, squareStride],
          },

          fragment: {
            module: fragmentShader,
            entryPoint: 'main',
            targets: [
              {
                format: this.presentationFormat,
              },
            ],
          },
          
        };

        this.renderPipeline = this.device.createRenderPipeline(pipelineDescriptor);

        this.uniformBindGroup = this.device.createBindGroup({
            layout: this.renderPipeline.getBindGroupLayout(0),
            entries: [
              {
                binding: 0,
                resource: {
                  buffer:  this.sizeBuffer,
                  offset: 0,
                  size: 2 * Uint32Array.BYTES_PER_ELEMENT,
                },
              },
            ],
        });

        return true;
    }

    private resetGameData() {

      const resultInitializeBuffers=this.initializeRenderBuffers();
      const resdultInitializeComputeBuffers=this.initializeComputeBuffers();
      const resultIniitializeUniformBuffers=this.initializeUniformBuffers();

      const resultInitializePipline=this.initializeRenderPipline();
      const resdultInitializeComputePipline=this.initializeComputePipline();

      this.loopTimes = 0;
      requestAnimationFrame(this.renderFrame);

    }

    private async resetGameDataU() {

    //  const mappedData2 = new Float32Array(await this.uniformBuffer.mapWriteAsync());

      // map staging buffer to read results back to JS
      /*
      await this.uniformBuffer.mapAsync(
        GPUMapMode.WRITE,
        0, // Offset
        11*32, // Length
      );
*/

/*
    this.uniformBuffer = this.device.createBuffer({
      size: 11*32, // Assuming 16 bytes for the structure
      usage:    GPUBufferUsage.STORAGE | GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_DST,
      mappedAtCreation: true,
    });

    const mappedData2 = new Float32Array(this.uniformBuffer.getMappedRange());
    mappedData2[0] = this.CellUniform.k1;
    mappedData2[1] = this.CellUniform.k2;
    mappedData2[2] = this.CellUniform.k3;
    mappedData2[3] = this.CellUniform.k31;
    mappedData2[4] = this.CellUniform.k32;
    mappedData2[5] = this.CellUniform.k33;

    mappedData2[6] = this.CellUniform.status_max;
    mappedData2[7] = this.CellUniform.status_border;
    mappedData2[8] = this.CellUniform.angle_div;

    mappedData2[9] = this.CellUniform.dist_1;
    mappedData2[10] = this.CellUniform.dist_2;

    this.uniformBuffer.unmap();
    */
      //const mappedData2=this.uniformBuffer.getMappedRange(0,11*32);
      //const data = mappedData2.slice(0);
      /*
      // Update the mapped data with the new values
      mappedData2[0] = this.CellUniform.k1;
      mappedData2[1] = this.CellUniform.k2;
      mappedData2[2] = this.CellUniform.k3;
      mappedData2[3] = this.CellUniform.k31;
      mappedData2[4] = this.CellUniform.k32;
      mappedData2[5] = this.CellUniform.k33;

      mappedData2[6] = this.CellUniform.status_max;
      mappedData2[7] = this.CellUniform.status_border;
      mappedData2[8] = this.CellUniform.angle_div;

      mappedData2[9] = this.CellUniform.dist_1;
      mappedData2[10] = this.CellUniform.dist_2;
      */
      // Unmap the buffer
      //this.uniformBuffer.unmap();


      this.device.queue.writeBuffer(
        this.uniformBuffer,
        0,
        new Float32Array([
          this.CellUniform.k1,
          this.CellUniform.k2,
          this.CellUniform.k3,
          this.CellUniform.k31,
          this.CellUniform.k32,
          this.CellUniform.k33,
          this.CellUniform.status_max,
          this.CellUniform.status_border,
          this.CellUniform.angle_div,
          this.CellUniform.dist_1,
          this.CellUniform.dist_2,
        ])
      );
      requestAnimationFrame(this.renderFrame);

    }

    private renderFrame=()=> {
        this.wholeTime++;
        if (this.wholeTime >= this.GameOptions.timestep) {
            this.wholeTime -= this.GameOptions.timestep;
        }
        
        const view = this.context.getCurrentTexture().createView();
        const renderPass: GPURenderPassDescriptor = {
          colorAttachments: [
            {
              view,
              clearValue: { r: 0.75, g: 0.75, b: 0.75, a: 1.0 },
              loadOp: 'clear',
              storeOp: 'store',
            },
          ],
        };

        this.commandEncoder = this.device.createCommandEncoder();
  
        // compute
        const passEncoderCompute = this.commandEncoder.beginComputePass();
        passEncoderCompute.setPipeline(this.computePipeline);
        passEncoderCompute.setBindGroup(0, this.loopTimes ? this.bindGroup1 : this.bindGroup0);
        passEncoderCompute.dispatchWorkgroups(
            (this.GameOptions.width *this.GameOptions.height) / this.GameOptions.workgroupSize
        );
        passEncoderCompute.end();
        
        // render
        const passEncoderRender = this.commandEncoder.beginRenderPass(renderPass);
        passEncoderRender.setPipeline(this.renderPipeline);
        passEncoderRender.setVertexBuffer(0, this.bufferCellDraw);
        passEncoderRender.setVertexBuffer(1, this.squareBuffer);
        passEncoderRender.setBindGroup(0, this.uniformBindGroup);
        passEncoderRender.draw(4,this.length);
        passEncoderRender.end();
  
        this.device.queue.submit([this.commandEncoder.finish()]);

        this.anotherMethod();

        this.loopTimes = 1 - this.loopTimes;
    
        requestAnimationFrame(this.renderFrame);
    }

    public async init() {

        await this.initializeWebGPU();
        const resultInitializeBuffers=this.initializeRenderBuffers();
        const resdultInitializeComputeBuffers=this.initializeComputeBuffers();
        const resultIniitializeUniformBuffers=this.initializeUniformBuffers();

        const resultInitializePipline=this.initializeRenderPipline();
       
        const resdultInitializeComputePipline=this.initializeComputePipline();
        //const resultInitializeTextures=this.initializeTextures();
        

        this.gui.add(this.GameOptions, 'timestep', 1, 60, 1);
        this.gui.add(this.GameOptions, 'width', 3, 256, 1).onFinishChange(this.resetGameData);
        this.gui.add(this.GameOptions, 'height',3, 256,1).onFinishChange(this.resetGameData);
        /*
        this.gui
            .add(this.GameOptions, 'workgroupSize', [4, 8, 16])
            .onFinishChange(this.resetGameData);
            */

        this.gui.add(this.CellUniform, 'k1', 0.01, 1.0).onFinishChange(this.resetGameDataU);
        this.gui.add(this.CellUniform, 'k2', 0.01, 1.0).onFinishChange(this.resetGameDataU);
        this.gui.add(this.CellUniform, 'k3', 0.001, 0.25).onFinishChange(this.resetGameDataU);

        this.gui.add(this.CellUniform, 'k31', 0.1, 1.2).onFinishChange(this.resetGameDataU);
        this.gui.add(this.CellUniform, 'k32', 0.1, 1.2).onFinishChange(this.resetGameDataU);
        this.gui.add(this.CellUniform, 'k33', 0.1, 1.25).onFinishChange(this.resetGameDataU);

        this.gui.add(this.CellUniform, 'status_max', 3, 25).onFinishChange(this.resetGameDataU);
        this.gui.add(this.CellUniform, 'status_border', 1, 15).onFinishChange(this.resetGameDataU);
        this.gui.add(this.CellUniform, 'angle_div',1, 15).onFinishChange(this.resetGameDataU);
        this.gui.add(this.CellUniform, 'dist_1', 1, 7).onFinishChange(this.resetGameData);
        this.gui.add(this.CellUniform, 'dist_2', 1, 7).onFinishChange(this.resetGameData);

        this.gui.add(this, 'resetGameData').name('Reset Game Data');
 

        //requestAnimationFrame(this.renderFrame.bind(this));
    }

    private anotherMethod() {
        // Your code for another method
    }

    public runLoop() {
        requestAnimationFrame(this.renderFrame);
    }
}


