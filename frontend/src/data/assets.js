const ASSETS_BY_SCENE = {
  cheburashka_company: {
    0: { slug: 'cheburashka_company', name: 'cheburashka_company' },
    1: { slug: 'cheburashka_company', name: 'cheburashka_company' },
    2: { slug: 'cheburashka_company', name: 'cheburashka_company' },
  },
  volk: {},
};

export const ALL_ASSETS = Object.entries(ASSETS_BY_SCENE).flatMap(([sceneId, sceneAssets]) =>
  Object.entries(sceneAssets).map(([tagId, asset]) => ({
    sceneId,
    tagId: Number(tagId),
    ...asset,
  })),
);

export const getAssetByDetection = (sceneId, tagId) => {
  if (!sceneId && sceneId !== 0) return null;
  const sceneAssets = ASSETS_BY_SCENE[sceneId];
  if (!sceneAssets) return null;
  return sceneAssets[tagId] || null;
};

export const getSceneAssets = (sceneId) => {
  const sceneAssets = ASSETS_BY_SCENE[sceneId];
  if (!sceneAssets) return [];
  return Object.entries(sceneAssets).map(([tagId, asset]) => ({
    tagId: Number(tagId),
    ...asset,
  }));
};
