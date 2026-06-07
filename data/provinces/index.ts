import VN from "./vn";
import US from "./us";
import FR from "./fr";
import GB from "./gb";
import CA from "./ca";
import JP from "./jp";
import KR from "./kr";
import IN from "./in";
import ID from "./id";
import MY from "./my";
import AU from "./au";

export const PROVINCES_BY_COUNTRY = {
  VN,
  US,
  FR,
  GB,
  CA,
  JP,
  KR,
  IN,
  ID,
  MY,
  AU,
} as const;

export type CountryCodeWithProvinces =
  keyof typeof PROVINCES_BY_COUNTRY;
