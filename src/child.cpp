#include <v8.h>
#include <uv.h>
#include <nan.h>

// #include <iostream>

using namespace v8;
using namespace node;

#define JS_STR(...) Nan::New<v8::String>(__VA_ARGS__).ToLocalChecked()
#define JS_INT(val) Nan::New<v8::Integer>(val)
#define JS_NUM(val) Nan::New<v8::Number>(val)
#define JS_FLOAT(val) Nan::New<v8::Number>(val)
#define JS_BOOL(val) Nan::New<v8::Boolean>(val)

namespace vmone2 {

NAN_METHOD(InitChild) {
  if (info[0]->IsArray() && info[1]->IsObject()) {
    Local<Array> array = Local<Array>::Cast(info[0]);
    uint32_t a = array->Get(0)->Uint32Value();
    uint32_t b = array->Get(1)->Uint32Value();
    uintptr_t c = ((uintptr_t)a << 32) | (uintptr_t)b;
    void (*initFn)(Handle<Object>) = reinterpret_cast<void (*)(Handle<Object>)>(c);

    Local<Object> obj = Local<Object>::Cast(info[1]);
    (*initFn)(obj);
  } else {
    Nan::ThrowError("InitChild: Invalid argunents");
  }
}

void Init(Handle<Object> exports) {
  Nan::HandleScope scope;
  
  Local<Function> initChildFn = Nan::New<Function>(InitChild);
  exports->Set(JS_STR("initChild"), initChildFn);
  
  /* uintptr_t initFunctionAddress = (uintptr_t)vmone2::Init;
  Local<Array> initFunctionAddressArray = Nan::New<Array>(2);
  initFunctionAddressArray->Set(0, Nan::New<Integer>((uint32_t)(initFunctionAddress >> 32)));
  initFunctionAddressArray->Set(1, Nan::New<Integer>((uint32_t)(initFunctionAddress & 0xFFFFFFFF)));
  exports->Set(JS_STR("initFunctionAddress"), initFunctionAddressArray); */
}

}

#ifndef LUMIN
NODE_MODULE(NODE_GYP_MODULE_NAME, vmone2::Init)
#else
extern "C" {
  void node_register_module_worker_native2(Local<Object> exports, Local<Value> module, Local<Context> context) {
    vmone2::Init(exports);
  }
}
#endif
