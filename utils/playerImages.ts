import { ImageSourcePropType } from 'react-native';

// Player image map — keyed by player_id only.
// Add new entries per batch. Fallback: null (returns null, existing placeholder shown).
// CSK — Batch 1 (19 players)
const PLAYER_IMAGES: Record<string, ImageSourcePropType> = {
  '3cbc5a08-62af-4ca5-b709-c7712db6e8b6': require('../assets/images/players/3cbc5a08-62af-4ca5-b709-c7712db6e8b6.jpeg'),
  '7d053d4e-a735-4c96-bb98-4098dee523df': require('../assets/images/players/7d053d4e-a735-4c96-bb98-4098dee523df.jpeg'),
  '8df6183b-1c95-46d2-85c0-e185792d03f1': require('../assets/images/players/8df6183b-1c95-46d2-85c0-e185792d03f1.jpeg'),
  '9d8be8e7-4218-400f-919a-211415490575': require('../assets/images/players/9d8be8e7-4218-400f-919a-211415490575.jpeg'),
  '14a56d48-499a-4b03-aa0f-bd3f592e9d94': require('../assets/images/players/14a56d48-499a-4b03-aa0f-bd3f592e9d94.jpeg'),
  '35ed1b20-38f3-4013-be2e-dc28ffbecfd6': require('../assets/images/players/35ed1b20-38f3-4013-be2e-dc28ffbecfd6.jpeg'),
  '36e929d1-32f1-4d41-96c2-7df1364d0bab': require('../assets/images/players/36e929d1-32f1-4d41-96c2-7df1364d0bab.jpeg'),
  '50b70c71-1535-41c0-87fd-c12883105ede': require('../assets/images/players/50b70c71-1535-41c0-87fd-c12883105ede.jpeg'),
  '679f3d10-ac62-4f5b-89b2-7010935b9985': require('../assets/images/players/679f3d10-ac62-4f5b-89b2-7010935b9985.jpeg'),
  '6731db45-8132-49c6-8fcb-f59258d15082': require('../assets/images/players/6731db45-8132-49c6-8fcb-f59258d15082.jpeg'),
  'a9897a50-1497-4912-8899-e67898f87f82': require('../assets/images/players/a9897a50-1497-4912-8899-e67898f87f82.jpeg'),
  'b6e7aa41-b0bb-4b0f-8f59-59f729283be5': require('../assets/images/players/b6e7aa41-b0bb-4b0f-8f59-59f729283be5.jpeg'),
  'b55e1386-231c-4d40-9f6a-4d5a9512079c': require('../assets/images/players/b55e1386-231c-4d40-9f6a-4d5a9512079c.jpeg'),
  'c553c840-d84c-4a9f-a714-406ffe44f1e9': require('../assets/images/players/c553c840-d84c-4a9f-a714-406ffe44f1e9.jpeg'),
  'cbe808da-727a-4d9c-b3be-6eb431217483': require('../assets/images/players/cbe808da-727a-4d9c-b3be-6eb431217483.jpeg'),
  'd774adaf-78f0-4bf3-965e-8182c05b4517': require('../assets/images/players/d774adaf-78f0-4bf3-965e-8182c05b4517.jpeg'),
  'dc2f7f59-ce15-48aa-b7d9-793314961076': require('../assets/images/players/dc2f7f59-ce15-48aa-b7d9-793314961076.jpeg'),
  'f63eb69e-f17e-4d88-bf2b-d91af645c52c': require('../assets/images/players/f63eb69e-f17e-4d88-bf2b-d91af645c52c.jpeg'),
  'fb46a43c-3deb-489d-8641-5d1744dfbf81': require('../assets/images/players/fb46a43c-3deb-489d-8641-5d1744dfbf81.jpeg'),
  // CSK — Batch 2 (5 players)
  '22ee45d8-0538-4e3e-a758-c515f9b86d11': require('../assets/images/players/22ee45d8-0538-4e3e-a758-c515f9b86d11.jpeg'),
  '34ae4dde-3ec7-48a7-a2c1-d4e55122ff68': require('../assets/images/players/34ae4dde-3ec7-48a7-a2c1-d4e55122ff68.jpeg'),
  'b65be7fe-33cd-41d1-b601-31f25b4f72a4': require('../assets/images/players/b65be7fe-33cd-41d1-b601-31f25b4f72a4.jpeg'),
  'c87a375e-2731-405d-a30e-3b99c06f614e': require('../assets/images/players/c87a375e-2731-405d-a30e-3b99c06f614e.jpeg'),
  'ec1b806b-de33-4b79-b3ba-8a5ad78df163': require('../assets/images/players/ec1b806b-de33-4b79-b3ba-8a5ad78df163.jpeg'),
  // Other teams — append here (RCB, MI, etc.)
};

export function getPlayerImage(playerId?: string | null): ImageSourcePropType | null {
  if (!playerId) return null;
  return PLAYER_IMAGES[playerId] ?? null;
}
