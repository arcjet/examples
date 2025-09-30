import arcjetNode from "@arcjet/node";

export const arcjet = arcjetNode({
  key: process.env.ARCJET_KEY!,
  rules: [],
});
