import { onMounted, ref, shallowRef, type Ref } from "vue";
import type { DataStatus } from "../types/api";

export interface AsyncViewState<T> {
  status: Ref<DataStatus>;
  data: Ref<T | null>;
  errorMessage: Ref<string>;
  refresh: () => Promise<void>;
}

export function useAsyncView<T>(
  loader: () => Promise<T>,
  isEmpty: (value: T) => boolean,
  loadOnMounted = true,
): AsyncViewState<T> {
  const status = ref<DataStatus>("loading");
  const data = shallowRef<T | null>(null) as Ref<T | null>;
  const errorMessage = ref("Request failed.");

  const refresh = async (): Promise<void> => {
    status.value = "loading";
    errorMessage.value = "Request failed.";

    try {
      const response = await loader();
      data.value = response;
      status.value = isEmpty(response) ? "empty" : "ready";
    } catch (error) {
      status.value = "error";
      errorMessage.value = error instanceof Error ? error.message : "Unexpected error";
    }
  };

  if (loadOnMounted) {
    onMounted(() => {
      void refresh();
    });
  }

  return {
    status,
    data,
    errorMessage,
    refresh,
  };
}
