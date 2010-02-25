// Copyright (c) 2009 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

// This file contains the GLES2Decoder class.

#ifndef GPU_COMMAND_BUFFER_SERVICE_GLES2_CMD_DECODER_H_
#define GPU_COMMAND_BUFFER_SERVICE_GLES2_CMD_DECODER_H_

#include <build/build_config.h>
#if defined(OS_WIN)
#include <windows.h>
#endif
#include "base/callback.h"
#if defined(OS_MACOSX)
#include "chrome/common/transport_dib.h"
#endif
#include "gpu/command_buffer/service/common_decoder.h"


namespace gpu {
// Forward-declared instead of including x_utils.h, because including glx.h
// causes havok.
class XWindowWrapper;

namespace gles2 {

class ContextGroup;

// This class implements the AsyncAPIInterface interface, decoding GLES2
// commands and calling GL.
class GLES2Decoder : public CommonDecoder {
 public:
  typedef error::Error Error;

  // Creates a decoder.
  static GLES2Decoder* Create(ContextGroup* group);

  virtual ~GLES2Decoder();

  bool debug() const {
    return debug_;
  }

  void set_debug(bool debug) {
    debug_ = debug;
  }

#if defined(OS_LINUX)
  void set_window_wrapper(XWindowWrapper *window) {
    window_ = window;
  }
  XWindowWrapper* window() const {
    return window_;
  }
#elif defined(OS_WIN)
  void set_hwnd(HWND hwnd) {
    hwnd_ = hwnd;
  }

  HWND hwnd() const {
    return hwnd_;
  }
#elif defined(OS_MACOSX)
  virtual uint64 SetWindowSizeForIOSurface(int32 width, int32 height) = 0;
  virtual TransportDIB::Handle SetWindowSizeForTransportDIB(int32 width,
                                                            int32 height) = 0;
  virtual void SetTransportDIBAllocAndFree(
      Callback2<size_t, TransportDIB::Handle*>::Type* allocator,
      Callback1<TransportDIB::Id>::Type* deallocator) = 0;
#endif

  // Initializes the graphics context.
  // Returns:
  //   true if successful.
  virtual bool Initialize() = 0;

  // Destroys the graphics context.
  virtual void Destroy() = 0;

  // Make this decoder's GL context current.
  virtual bool MakeCurrent() = 0;

  // Gets a service id by client id.
  virtual uint32 GetServiceIdForTesting(uint32 client_id) = 0;

  // Sets a callback which is called when a SwapBuffers command is processed.
  virtual void SetSwapBuffersCallback(Callback0::Type* callback) = 0;

 protected:
  explicit GLES2Decoder(ContextGroup* group);

  ContextGroup* group_;

 private:
  bool debug_;

#if defined(OS_LINUX)
  XWindowWrapper *window_;
#elif defined(OS_WIN)
  // Handle to the GL device.
  HWND hwnd_;
#endif

  DISALLOW_COPY_AND_ASSIGN(GLES2Decoder);
};

}  // namespace gles2
}  // namespace gpu

#endif  // GPU_COMMAND_BUFFER_SERVICE_GLES2_CMD_DECODER_H_
