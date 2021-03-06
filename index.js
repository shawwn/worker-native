const path = require('path');
const {EventEmitter} = require('events');
const {Worker} = require('worker_threads');
const vmOnePath = path.join(__dirname, 'build', 'Release', 'worker_native.node');
const {
  WorkerNative: nativeWorkerNative,
  RequestContext: nativeRequestContext,
} = typeof requireNative === 'undefined' ?
  require(path.join(__dirname, 'build', 'Release', 'worker_native.node'))
:
  requireNative('worker_native.node');
const vmOne2SoPath = require.resolve(path.join(__dirname, 'build', 'Release', 'worker_native2.node'));
const childJsPath = path.join(__dirname, 'child.js');

const eventLoopNative = require('event-loop-native');
nativeWorkerNative.setEventLoop(eventLoopNative);
nativeWorkerNative.dlclose(eventLoopNative.getDlibPath());

nativeWorkerNative.setNativeRequire('worker_native.node', nativeWorkerNative.initFunctionAddress);

/* let compiling = false;
const make = () => new VmOne(e => {
  if (e === 'compilestart') {
    compiling = true;
  } else if (e === 'compileend') {
    compiling = false;
  }
}, __dirname + path.sep);
const isCompiling = () => compiling; */

class NativeWorker extends EventEmitter {
  constructor(options = {}) {
    super();

    const instance = new nativeWorkerNative();

    const worker = new Worker(childJsPath, {
      workerData: {
        initFunctionAddress: nativeWorkerNative.initFunctionAddress,
        array: instance.toArray(),
        initModule: options.initModule,
        args: options.args,
      },
    });
    worker.on('message', m => {
      switch (m.method) {
        case 'postMessage': {
          this.emit('message', m);
          break;
        }
        case 'emit': {
          this.emit(m.type, m.event);
          break;
        }
        default: {
          throw new Error(`worker got unknown message type '${m.method}'`);
          break;
        }
      }
    });
    worker.on('error', err => {
      this.emit('error', err);
    });
    instance.request();
    nativeWorkerNative.dlclose(vmOne2SoPath); // so we can re-require the module from a different child

    this.instance = instance;
    this.worker = worker;
  }

  runSync(jsString, arg, transferList) {
    this.worker.postMessage({
      method: 'runSync',
      jsString,
      arg,
    }, transferList);
    const {err, result} = JSON.parse(this.instance.popResult());
    if (!err) {
      return result;
    } else {
      throw new Error(err);
    }
  }
  runRepl(jsString, transferList) {
    return new Promise((accept, reject) => {
      const requestKey = this.instance.queueAsyncRequest(s => {
        const o = JSON.parse(s);
        if (!o.err) {
          accept(o.result);
        } else {
          reject(o.err);
        }
      });
      this.worker.postMessage({
        method: 'runRepl',
        jsString,
        requestKey,
      }, transferList);
    });
  }
  runAsync(jsString, arg, transferList) {
    return new Promise((accept, reject) => {
      const requestKey = this.instance.queueAsyncRequest(s => {
        const o = JSON.parse(s);
        if (!o.err) {
          accept(o.result);
        } else {
          reject(o.err);
        }
      });
      this.worker.postMessage({
        method: 'runAsync',
        jsString,
        arg,
        requestKey,
      }, transferList);
    });
  }
  runDetached(jsString, arg, transferList) {
    this.worker.postMessage({
      method: 'runDetached',
      jsString,
      arg,
    }, transferList);
  }
  postMessage(message, transferList) {
    this.worker.postMessage({
      method: 'postMessage',
      message,
    }, transferList);
  }
  
  destroy() {
    this.worker.terminate();
  }

  get onmessage() {
    return this.listeners('message')[0];
  }
  set onmessage(onmessage) {
    this.on('message', onmessage);
  }

  get onerror() {
    return this.listeners('error')[0];
  }
  set onerror(onerror) {
    this.on('error', onerror);
  }
}

class RequestContext {
  constructor(instance = new nativeRequestContext()) {
    this.instance = instance;
  }

  makeThread(handlers) {
    this.instance.makeThread(handlers);
  }

  /* makeAsync(handlers) {
    this.instance.makeAsync(handlers);
  } */

  /* setSyncHandler(fn) {
    console.log('set sync handler', new Error().stack);
    this.instance.setSyncHandler(s => {
      try {
        const m = JSON.parse(s);
        let result, err;
        try {
          result = fn(m);
        } catch(e) {
          err = e.stack;
        }
        this.instance.pushResult(JSON.stringify({result, err}));
      } catch(err) {
        console.warn(err.stack);
      }
    });
  } */
  
  pushSyncRequest(method, args) {
    this.instance.pushSyncRequest(method, args);
  }
  
  popResult() {
    return this.instance.popResult();
  }
}

const _makeRequestContext = rc => {
  const requestContext = new RequestContext(rc);
  requestContext.runSyncTop = function(method, argsBuffer) {
    this.pushSyncRequest(method, argsBuffer);
    const result = this.popResult();
    return result;
  };
  return requestContext;
};

const vmOne = {
  make(options = {}) {
    return new NativeWorker(options);
  },
  makeRequestContext() {
    return _makeRequestContext();
  },
  getEventLoop: nativeWorkerNative.getEventLoop,
  setEventLoop: nativeWorkerNative.setEventLoop,
  getTopRequestContext() {
    return _makeRequestContext(nativeRequestContext.getTopRequestContext());
  },
  setTopRequestContext(requestContext) {
    nativeRequestContext.setTopRequestContext(requestContext.instance);
  },
  setNativeRequire: nativeWorkerNative.setNativeRequire,
  requireNative: nativeWorkerNative.requireNative,
  initFunctionAddress: nativeWorkerNative.initFunctionAddress,
  fromArray(arg) {
    return new nativeWorkerNative(arg);
  },
  dlclose: nativeWorkerNative.dlclose,
}

module.exports = vmOne;
