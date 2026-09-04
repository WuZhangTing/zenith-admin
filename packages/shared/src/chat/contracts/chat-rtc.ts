import * as z from 'zod';

/** ICE 服务器配置（前端 RTCPeerConnection 用） */
export const rtcIceServerConfigSchema = z.object({
  urls: z.union([z.string(), z.array(z.string())]),
  username: z.string().optional(),
  credential: z.string().optional(),
}).meta({ id: 'RtcIceServer' });

export type RtcIceServerConfig = z.infer<typeof rtcIceServerConfigSchema>;

export const rtcConfigSchema = z.object({
  iceServers: z.array(rtcIceServerConfigSchema),
}).meta({ id: 'RtcConfig' });

export type RtcConfig = z.infer<typeof rtcConfigSchema>;
