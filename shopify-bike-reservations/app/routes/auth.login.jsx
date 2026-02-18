import { login } from "../shopify.server";

export const loader = async ({ request }) => {
  await login(request);
  return null;
};

export const action = async ({ request }) => {
  await login(request);
  return null;
};
