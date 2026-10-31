import { z } from "zod";

export const cspReportPayloadSchema = z.object({
  "csp-report": z.object({
    "document-uri": z.string().min(1),
    referrer: z.string().optional().default(""),
    "violated-directive": z.string().min(1),
    "effective-directive": z.string().optional(),
    "original-policy": z.string().optional(),
    disposition: z.string().optional().default("enforce"),
    "blocked-uri": z.string(),
    "line-number": z.number().int().optional(),
    "column-number": z.number().int().optional(),
    "source-file": z.string().optional(),
    "status-code": z.number().int().optional(),
    "script-sample": z.string().optional().default(""),
  }),
});

export type CspReportPayload = z.infer<typeof cspReportPayloadSchema>;
