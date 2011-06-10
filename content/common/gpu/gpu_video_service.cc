// Copyright (c) 2011 The Chromium Authors. All rights reserved.
// Use of this source code is governed by a BSD-style license that can be
// found in the LICENSE file.

#include "content/common/gpu/gpu_video_service.h"

#include "content/common/gpu/gpu_channel.h"
#include "content/common/gpu/gpu_messages.h"
#include "content/common/gpu/gpu_video_decode_accelerator.h"
#include "gpu/command_buffer/service/gles2_cmd_decoder.h"

#if defined(OS_CHROMEOS) && defined(ARCH_CPU_ARMEL)
#include "content/common/gpu/omx_video_decode_accelerator.h"
#include "ui/gfx/gl/gl_surface_egl.h"
#endif  // defined(OS_CHROMEOS) && defined(ARCH_CPU_ARMEL)

GpuVideoService::GpuVideoService() {
  // TODO(jiesun): move this time consuming stuff out of here.
  IntializeGpuVideoService();
}

GpuVideoService::~GpuVideoService() {
  // TODO(jiesun): move this time consuming stuff out of here.
  UnintializeGpuVideoService();
}

// static
GpuVideoService* GpuVideoService::GetInstance() {
  return Singleton<GpuVideoService>::get();
}

void GpuVideoService::OnChannelConnected(int32 peer_pid) {
  LOG(ERROR) << "GpuVideoService::OnChannelConnected";
}

void GpuVideoService::OnChannelError() {
  LOG(ERROR) << "GpuVideoService::OnChannelError";
}

bool GpuVideoService::OnMessageReceived(const IPC::Message& msg) {
#if 0
  IPC_BEGIN_MESSAGE_MAP(GpuVideoService, msg)
    IPC_MESSAGE_UNHANDLED_ERROR()
  IPC_END_MESSAGE_MAP()
#endif
  return false;
}

bool GpuVideoService::IntializeGpuVideoService() {
  return true;
}

bool GpuVideoService::UnintializeGpuVideoService() {
  return true;
}

bool GpuVideoService::CreateVideoDecoder(
    GpuChannel* channel,
    MessageRouter* router,
    int32 decoder_host_id,
    int32 decoder_id,
    gpu::gles2::GLES2Decoder* command_decoder,
    const std::vector<uint32>& configs) {
  // Create GpuVideoDecodeAccelerator and add to map.
  scoped_refptr<GpuVideoDecodeAccelerator> decoder =
      new GpuVideoDecodeAccelerator(channel, decoder_host_id);

#if defined(OS_CHROMEOS) && defined(ARCH_CPU_ARMEL)
  OmxVideoDecodeAccelerator* omx_decoder =
      new OmxVideoDecodeAccelerator(decoder, MessageLoop::current());
  omx_decoder->SetEglState(gfx::GLSurfaceEGL::GetDisplay(),
                           command_decoder->GetGLContext()->GetHandle());
  decoder->set_video_decode_accelerator(omx_decoder);

#endif  // defined(OS_CHROMEOS) && defined(ARCH_CPU_ARMEL)

  bool result = decoder_map_.insert(std::make_pair(
      decoder_id, VideoDecoderInfo(decoder, command_decoder))).second;

  // Decoder ID is a unique ID determined by GpuVideoServiceHost.
  // We should always be adding entries here.
  DCHECK(result);

  router->AddRoute(decoder_id, decoder);

  // Tell client that initialization is complete.
  channel->Send(
      new AcceleratedVideoDecoderHostMsg_CreateDone(
          decoder_host_id, decoder_id));

  return true;
}

void GpuVideoService::DestroyVideoDecoder(
    MessageRouter* router,
    int32 decoder_id) {
  router->RemoveRoute(decoder_id);
  decoder_map_.erase(decoder_id);
}

void GpuVideoService::AssignTexturesToDecoder(
    int32 decoder_id,
    const std::vector<int32>& buffer_ids,
    const std::vector<uint32>& texture_ids,
    const std::vector<gfx::Size>& sizes) {
  std::vector<media::GLESBuffer> buffers;
  for (uint32 i = 0; i < buffer_ids.size(); ++i) {
    uint32 service_texture_id;
    bool result = TranslateTextureForDecoder(
        decoder_id, texture_ids[i], &service_texture_id);
    // TODO(vrk): Send an error for invalid GLES buffers.
    if (!result)
      return;
    buffers.push_back(
        media::GLESBuffer(buffer_ids[i], sizes[i], service_texture_id));
  }

  DecoderMap::iterator it = decoder_map_.find(decoder_id);
  DCHECK(it != decoder_map_.end());
  it->second.video_decoder->AssignGLESBuffers(buffers);
}

bool GpuVideoService::TranslateTextureForDecoder(
    int32 decoder_id, uint32 client_texture_id, uint32* service_texture_id) {
  DecoderMap::iterator it = decoder_map_.find(decoder_id);
  if (it == decoder_map_.end())
    return false;
  it->second.command_decoder->MakeCurrent();
  return it->second.command_decoder->GetServiceTextureId(
      client_texture_id, service_texture_id);
}
