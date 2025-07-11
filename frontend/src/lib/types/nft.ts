export interface NFT {
  _id: string;
  name: string,
  description: string,
  creator: string,
  imageurl: string,
  imagehash: string,
  time_created: Date,
  part_count: number,
  status: string,
  nftHash: string;
}

export interface Part {
  _id: string;
  part_no: number,
  parent_hash: string,
  owner: string,
  price: number,
  listing: string
}


export interface Listing {
    _id: string;
    price: string;
    nftId: string;
    seller: string;
    parts: string[];
  };