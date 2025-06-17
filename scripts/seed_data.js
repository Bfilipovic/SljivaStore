const nfts = [
  {
    name: "Test NFT #1",
    description: "First NFT",
    image: "https://www.froghollow.com/cdn/shop/articles/santa_rosa_1_lr_sq_d32c08e2-0cf8-445c-abf7-8681e5b6d852.jpg?v=1565715872",
    owner: "0x0000000000000000000000000000000000000000",
    price: 0.5,
    nftHash: ""
  },
  {
    name: "NFT #2",
    description: "Second NFT. It is owned by an user",
    image: "https://www.rasadnikcolicmilos.rs/wp-content/uploads/2017/12/Dunja-Vranjska.jpg",
    owner: "0x0000000000000000000000000000000000000000",
    price: 0.75,
    nftHash: ""
  }
];

db = connect("mongodb://localhost:27017/nftstore"); // Replace with your DB name

db.nfts.insertMany(nfts);
