export const newsCategoryLabels: Record<string, string> = {
  announcement: "Announcement",
  award: "Award",
  press_release: "Press Release",
  achievement: "Achievement",
};

export type NewsCategory = keyof typeof newsCategoryLabels;
