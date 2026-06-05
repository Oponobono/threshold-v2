interface FormData {
  append(key: string, value: string | { name?: string; type?: string; uri: string }): void;
}
