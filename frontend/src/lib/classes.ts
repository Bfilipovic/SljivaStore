export class NFT {
  _id: string;
  name: string;
  description: string;
  creator: string;
  imageurl: string;
  part_count: number;
  constructor(data: any) {
    this._id = data._id;
    this.name = data.name;
    this.description = data.description;
    this.creator = data.creator;
    this.imageurl = data.imageurl;
    this.part_count = data.part_count;
  }
}

export class Part {
  _id: string;
  part_no: number;
  parent_hash: string;
  owner: string;
  listing: string | null;
  constructor(data: any) {
    this._id = data._id;
    this.part_no = data.part_no;
    this.parent_hash = data.parent_hash;
    this.owner = data.owner;
    this.listing = data.listing ?? null;
  }
}

export class Listing {
  _id: string;
  price: string;
  nftId: string;
  seller: string;
  parts: string[];
  time_created?: Date;
  constructor(data: any) {
    this._id = data._id;
    this.price = data.price;
    this.nftId = data.nftId;
    this.seller = data.seller;
    this.parts = data.parts;
    this.time_created = data.time_created ? new Date(data.time_created) : undefined;
  }
}
