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
  nftId: string;
  seller: string;
  price: string;
  parts: string[];
  status: string;
  type: string;
  quantity : number;
  availableQuantity?: number; // Cached count of actually available parts (not reserved)

  constructor(data: any) {
    this._id = data._id;
    this.nftId = data.nftId;
    this.seller = data.seller;
    this.price = data.price;
    this.parts = data.parts;
    this.status = data.status;
    this.type = data.type;   // ✅ ensure type is preserved
    this.quantity = data.quantity; // ✅ ensure quantity is preserved
    this.availableQuantity = data.availableQuantity; // ✅ ensure availableQuantity is preserved
  }
}
