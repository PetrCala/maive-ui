import type CONST from "@src/CONST";
import type { DeepValueOf } from "@src/types";

type AlertType = DeepValueOf<typeof CONST.ALERT_TYPES>;

export type { AlertType };
