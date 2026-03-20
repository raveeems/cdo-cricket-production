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
  // RCB — Batch 1 (17 players) + Batch 2 deferred (Kanishk Chouhan + Suyash Sharma) + Batch 2 (6 players) = 25 RCB total
  '849877f5-7704-4cad-b1ba-9e0b33aed35e': require('../assets/images/players/849877f5-7704-4cad-b1ba-9e0b33aed35e.jpeg'),
  '3f3ecf51-8411-4046-9477-18c0fe3da6ac': require('../assets/images/players/3f3ecf51-8411-4046-9477-18c0fe3da6ac.jpeg'),
  '74c6584a-45a5-4781-a5e7-c0c9340da954': require('../assets/images/players/74c6584a-45a5-4781-a5e7-c0c9340da954.jpeg'),
  'd8b0e01b-b754-432b-80a4-551e8c7ec8ca': require('../assets/images/players/d8b0e01b-b754-432b-80a4-551e8c7ec8ca.jpeg'),
  '6e05cbea-6a4b-42ef-8e2e-b44e4b434c2f': require('../assets/images/players/6e05cbea-6a4b-42ef-8e2e-b44e4b434c2f.jpeg'),
  'e28de73b-f5df-49eb-bdf6-c50471319404': require('../assets/images/players/e28de73b-f5df-49eb-bdf6-c50471319404.jpeg'),
  '40ed69da-5d26-45eb-b9f8-72140b81b51a': require('../assets/images/players/40ed69da-5d26-45eb-b9f8-72140b81b51a.jpeg'),
  '2190c28d-1712-4fd2-ae44-9ac54319fc21': require('../assets/images/players/2190c28d-1712-4fd2-ae44-9ac54319fc21.jpeg'),
  '81c09c1b-1b1d-4e87-9eaa-d7d0a89a6159': require('../assets/images/players/81c09c1b-1b1d-4e87-9eaa-d7d0a89a6159.jpeg'),
  '4c17aaba-7455-4e74-82ac-86e60d480999': require('../assets/images/players/4c17aaba-7455-4e74-82ac-86e60d480999.jpeg'),
  'eb911b3b-10b3-40f8-9294-e63ba030af83': require('../assets/images/players/eb911b3b-10b3-40f8-9294-e63ba030af83.jpeg'),
  '6db25d60-ff96-4d8d-8d22-dedeeb5ffa29': require('../assets/images/players/6db25d60-ff96-4d8d-8d22-dedeeb5ffa29.jpeg'),
  '88215ee9-ca67-48af-a3f0-6b38718bd830': require('../assets/images/players/88215ee9-ca67-48af-a3f0-6b38718bd830.jpeg'),
  'a1f7a1f3-f19c-43d2-bcd7-b4bae22f5842': require('../assets/images/players/a1f7a1f3-f19c-43d2-bcd7-b4bae22f5842.jpeg'),
  '7fd4fa20-bc49-4337-ae8a-540b67cb011d': require('../assets/images/players/7fd4fa20-bc49-4337-ae8a-540b67cb011d.jpeg'),
  '3676cc16-9ddf-446f-a4f1-93dbbef6e132': require('../assets/images/players/3676cc16-9ddf-446f-a4f1-93dbbef6e132.jpeg'),
  '41f91a34-8989-4b88-96b9-9fbbe725776f': require('../assets/images/players/41f91a34-8989-4b88-96b9-9fbbe725776f.jpeg'),
  '2bf2258f-f35e-4831-884e-f88ef46968f5': require('../assets/images/players/2bf2258f-f35e-4831-884e-f88ef46968f5.jpeg'),
  '2dbeb6b1-b7a7-4609-810a-df536c049ee0': require('../assets/images/players/2dbeb6b1-b7a7-4609-810a-df536c049ee0.jpeg'),
  '69718248-2a3a-45d4-9a2a-6f4dfc6942a5': require('../assets/images/players/69718248-2a3a-45d4-9a2a-6f4dfc6942a5.jpeg'),
  'b9701b53-3b9e-4eda-93b1-3543809674d4': require('../assets/images/players/b9701b53-3b9e-4eda-93b1-3543809674d4.jpeg'),
  'c3236037-6694-404a-8f01-9ad880564ea9': require('../assets/images/players/c3236037-6694-404a-8f01-9ad880564ea9.jpeg'),
  'c61d247d-7f77-452c-b495-2813a9cd0ac4': require('../assets/images/players/c61d247d-7f77-452c-b495-2813a9cd0ac4.jpeg'),
  'e5932c98-5c2a-4ade-8238-3b6382b18ef3': require('../assets/images/players/e5932c98-5c2a-4ade-8238-3b6382b18ef3.jpeg'),
  'f061b5fc-cd70-480c-86aa-45c7828e739c': require('../assets/images/players/f061b5fc-cd70-480c-86aa-45c7828e739c.jpeg'),
  // SRH — Batch 1 (19 players)
  '83fe6ab6-d63c-420e-9416-a93d59a9a964': require('../assets/images/players/83fe6ab6-d63c-420e-9416-a93d59a9a964.jpeg'),
  '6ed13677-5228-45cf-8cfb-c72c476f8fdb': require('../assets/images/players/6ed13677-5228-45cf-8cfb-c72c476f8fdb.jpeg'),
  '196f622e-e1ae-4962-95b5-81324e26c5fe': require('../assets/images/players/196f622e-e1ae-4962-95b5-81324e26c5fe.jpeg'),
  'd50e7092-dc22-4854-84d3-e08ccba038e9': require('../assets/images/players/d50e7092-dc22-4854-84d3-e08ccba038e9.jpeg'),
  '7aa19b4a-48ef-4d17-bef7-1e71f7829cb5': require('../assets/images/players/7aa19b4a-48ef-4d17-bef7-1e71f7829cb5.jpeg'),
  'cc7c9a0b-b6ac-4109-84c8-dd9b1704308f': require('../assets/images/players/cc7c9a0b-b6ac-4109-84c8-dd9b1704308f.jpeg'),
  '15bccb4f-8c3c-4da6-acd9-551782278bfd': require('../assets/images/players/15bccb4f-8c3c-4da6-acd9-551782278bfd.jpeg'),
  '7d662361-8f12-4a52-9a4b-01e8734bd31d': require('../assets/images/players/7d662361-8f12-4a52-9a4b-01e8734bd31d.jpeg'),
  '9ae68636-48d9-488f-8adc-e62a19815d85': require('../assets/images/players/9ae68636-48d9-488f-8adc-e62a19815d85.jpeg'),
  '6d751be3-3023-43b9-8415-8259d19689fd': require('../assets/images/players/6d751be3-3023-43b9-8415-8259d19689fd.jpeg'),
  'f589d2a9-4e44-464d-9741-e224354a1370': require('../assets/images/players/f589d2a9-4e44-464d-9741-e224354a1370.jpeg'),
  'b4cc5506-212f-4d6b-825d-8ec89e1e084a': require('../assets/images/players/b4cc5506-212f-4d6b-825d-8ec89e1e084a.jpeg'),
  '391537b8-1983-4080-8737-976c7e5bfab7': require('../assets/images/players/391537b8-1983-4080-8737-976c7e5bfab7.jpeg'),
  'd1c0a448-6ee6-473a-90a2-e6a486698a8a': require('../assets/images/players/d1c0a448-6ee6-473a-90a2-e6a486698a8a.jpeg'),
  '5bf98798-b2b0-47d2-b799-5307c0fd4936': require('../assets/images/players/5bf98798-b2b0-47d2-b799-5307c0fd4936.jpeg'),
  '0cf24408-c280-406d-8d7a-a78b0c3964ed': require('../assets/images/players/0cf24408-c280-406d-8d7a-a78b0c3964ed.jpeg'),
  '13b3d56e-0fba-4d31-a174-d211211404e2': require('../assets/images/players/13b3d56e-0fba-4d31-a174-d211211404e2.jpeg'),
  '8f631eea-fa55-4296-b7cb-4f51e8ee2c98': require('../assets/images/players/8f631eea-fa55-4296-b7cb-4f51e8ee2c98.jpeg'),
  '02247315-1e19-4e52-b800-5f39efaf3839': require('../assets/images/players/02247315-1e19-4e52-b800-5f39efaf3839.jpeg'),
  // SRH — Batch 2 (6 players) — append here
  // Other teams — append here (MI, DC, etc.)
};

export function getPlayerImage(playerId?: string | null): ImageSourcePropType | null {
  if (!playerId) return null;
  return PLAYER_IMAGES[playerId] ?? null;
}
