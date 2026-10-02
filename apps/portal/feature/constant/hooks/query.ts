import { useQuery } from "@tanstack/react-query";

// Masking server action for handling API requests with packed results
import { unpackActionResult } from "@/lib/api/unpack-server-result";
import { getFeatureGroupsAction } from "../actions";

export function useFeatureGroupsQuery(lang: string) {
  return useQuery({
    queryKey: ["featureGroups", lang],
    queryFn: async () => {
      return getFeatureGroupsAction(lang).then(unpackActionResult);
    },
  });
}
