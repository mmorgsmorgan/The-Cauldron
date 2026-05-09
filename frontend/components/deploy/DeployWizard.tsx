"use client";

import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { isAddress, parseEther, zeroHash, decodeEventLog } from "viem";
import { FACTORY_ADDRESS, NFTFactory_ABI } from "@/lib/contracts";
import { generateMerkleRoot } from "@/lib/api";
import { uploadToPinata, uploadMetadataFolderToPinata, resolveIPFSGateway } from "@/lib/pinata";
import Link from "next/link";

type Step = 1 | 2 | 3 | 4 | 5;

const STEPS = [
  { num: 1, label: "TYPE" },
  { num: 2, label: "DETAILS" },
  { num: 3, label: "EARNINGS" },
  { num: 4, label: "SCHEDULE" },
  { num: 5, label: "REVIEW" },
];

export default function DeployWizard() {
  const { address } = useAccount();
  const [step, setStep] = useState<Step>(1);

  // Step 1 — Type
  const [collectionType, setCollectionType] = useState<"erc721a" | "erc1155">("erc721a");

  // Step 2 — Details
  const [name, setName] = useState("");
  const [symbol, setSymbol] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [imageUploading, setImageUploading] = useState(false);
  const [description, setDescription] = useState("");
  const [maxSupply, setMaxSupply] = useState("1000");
  const [contractType, setContractType] = useState<"proxy" | "standard">("proxy");

  // Multi-image mode
  const [imageMode, setImageMode] = useState<"single" | "multi">("single");
  const [multiImages, setMultiImages] = useState<{ file: File; preview: string; cid?: string }[]>([]);
  const [uploadProgress, setUploadProgress] = useState("");
  const [coverMode, setCoverMode] = useState<"first" | "pick" | "custom">("first");
  const [coverIndex, setCoverIndex] = useState(0);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [coverCid, setCoverCid] = useState("");

  async function handleImageUpload(file: File) {
    setImageUploading(true);
    setImagePreview(URL.createObjectURL(file));
    try {
      const ipfsUrl = await uploadToPinata(file);
      setImageUrl(ipfsUrl);
    } catch (err) {
      console.error("Upload failed:", err);
    }
    setImageUploading(false);
  }

  // Step 3 — Earnings
  const [royaltyFee, setRoyaltyFee] = useState("5");
  const [royaltyRecipient, setRoyaltyRecipient] = useState("");

  // Step 4 — Schedule
  const [mintDate, setMintDate] = useState("");
  const [mintTime, setMintTime] = useState("");
  const [gtdEnabled, setGtdEnabled] = useState(true);
  const [gtdPrice, setGtdPrice] = useState("0.01");
  const [gtdMax, setGtdMax] = useState("3");
  const [gtdDurHours, setGtdDurHours] = useState("1");
  const [pubPrice, setPubPrice] = useState("0.02");
  const [pubMax, setPubMax] = useState("5");
  const [pubDurHours, setPubDurHours] = useState("2");
  const [allowlistCSV, setAllowlistCSV] = useState("");
  const [merkleRoot, setMerkleRoot] = useState<`0x${string}`>(zeroHash);
  const [csvFile, setCsvFile] = useState<string>("");

  // Deploy
  const { writeContract, data: txHash, isPending } = useWriteContract();
  const { isLoading: isConfirming, isSuccess, data: receipt } = useWaitForTransactionReceipt({ hash: txHash });

  // Parse deployed collection address from logs
  const deployedCollection = (() => {
    if (!receipt?.logs) return null;
    for (const log of receipt.logs) {
      try {
        const decoded = decodeEventLog({
          abi: [{
            type: "event", name: "CollectionCreated",
            inputs: [
              { name: "owner", type: "address", indexed: true },
              { name: "collection", type: "address", indexed: true },
              { name: "name", type: "string", indexed: false },
              { name: "symbol", type: "string", indexed: false },
              { name: "maxSupply", type: "uint256", indexed: false },
              { name: "timestamp", type: "uint256", indexed: false },
            ],
          }],
          data: log.data,
          topics: log.topics,
        });
        if (decoded.eventName === "CollectionCreated") {
          return (decoded.args as any).collection as `0x${string}`;
        }
      } catch {}
    }
    return null;
  })();

  // Ritual Chain uses millisecond block.timestamp (like Date.now()), not seconds
  function getStartTimestamp(): number {
    if (mintDate && mintTime) {
      const s = new Date(`${mintDate}T${mintTime}`).getTime();
      if (s > Date.now()) return Math.floor(s);
    }
    return Math.floor(Date.now());
  }

  function getScheduleLabel(): string {
    if (!mintDate || !mintTime) return "Starts immediately on deploy";
    const scheduled = new Date(`${mintDate}T${mintTime}`);
    if (scheduled <= new Date()) return "Starts immediately (time in the past)";
    const d = scheduled.getTime() - Date.now();
    return `Mint starts in ${Math.floor(d / 3600000)}h ${Math.floor((d % 3600000) / 60000)}m`;
  }

  async function handleMerkle() {
    const addrs = allowlistCSV.split(/[,\n\r]+/).map(a => a.trim()).filter(a => isAddress(a));
    if (!addrs.length) return;
    try { const r = await generateMerkleRoot(addrs); setMerkleRoot(r.root as `0x${string}`); } catch {}
  }

  function handleCSVUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      setCsvFile(file.name);
      // Extract addresses from CSV (first column)
      const lines = text.split("\n").slice(1);
      const addrs = lines.map(l => l.split(",")[0]?.trim()).filter(a => a ? isAddress(a) : false);
      setAllowlistCSV(addrs.join("\n"));
    };
    reader.readAsText(file);
  }

  async function handleDeploy() {
    if (!address) return;
    const start = getStartTimestamp();
    // Ritual Chain uses millisecond timestamps — convert hours to milliseconds
    const gtdMs = parseFloat(gtdDurHours) * 3600 * 1000;
    const pubMs = parseFloat(pubDurHours) * 3600 * 1000;
    const recipient = royaltyRecipient || address;

    let finalBaseURI = imageUrl || "";

    // Multi-image: upload all images then create metadata folder
    if (imageMode === "multi" && multiImages.length > 0) {
      setUploadProgress("Uploading images to IPFS...");
      const uploaded: { tokenId: number; name: string; description: string; imageCID: string }[] = [];
      const cidMap: string[] = [];
      for (let i = 0; i < multiImages.length; i++) {
        setUploadProgress(`Uploading image ${i + 1} of ${multiImages.length}...`);
        let cid = multiImages[i].cid;
        if (!cid) {
          cid = await uploadToPinata(multiImages[i].file);
        }
        cidMap.push(cid);
        uploaded.push({ tokenId: i + 1, name: `${name} #${i + 1}`, description, imageCID: cid });
      }
      setUploadProgress("Creating metadata folder...");

      // Determine cover image CID
      let chosenCoverCid = cidMap[0]; // default: first image
      if (coverMode === "pick" && coverIndex < cidMap.length) {
        chosenCoverCid = cidMap[coverIndex];
      } else if (coverMode === "custom" && coverFile) {
        setUploadProgress("Uploading cover image...");
        chosenCoverCid = coverCid || await uploadToPinata(coverFile);
      }

      // Pass cover CID so it's baked into the IPFS folder as metadata/0
      finalBaseURI = await uploadMetadataFolderToPinata(uploaded, chosenCoverCid);
      setImageUrl(chosenCoverCid);
      setUploadProgress("");
    }

    const phases = [];
    if (gtdEnabled) {
      phases.push({ startTime: BigInt(start), endTime: BigInt(start + gtdMs), price: parseEther(gtdPrice), maxPerWallet: +gtdMax, merkleRoot, isPublic: false });
      phases.push({ startTime: BigInt(start + gtdMs), endTime: BigInt(start + gtdMs + pubMs), price: parseEther(pubPrice), maxPerWallet: +pubMax, merkleRoot: zeroHash, isPublic: true });
    } else {
      phases.push({ startTime: BigInt(start), endTime: BigInt(start + pubMs), price: parseEther(pubPrice), maxPerWallet: +pubMax, merkleRoot: zeroHash, isPublic: true });
    }

    writeContract({
      address: FACTORY_ADDRESS, abi: NFTFactory_ABI, functionName: "createCollection",
      args: [name, symbol, finalBaseURI, BigInt(imageMode === "multi" ? multiImages.length : maxSupply), recipient as `0x${string}`,
        BigInt(Math.round(parseFloat(royaltyFee) * 100)),
        phases],
      gas: 1500000n,
    });
  }

  const canNext = () => {
    if (step === 1) return true;
    if (step === 2) return name && symbol;
    if (step === 3) return true;
    if (step === 4) return true;
    return true;
  };

  // When deploy succeeds, cache image + description in localStorage
  useEffect(() => {
    if (isSuccess && deployedCollection) {
      try {
        const metaCache: any = { description, name, symbol, imageMode };
        if (imageMode === "single") {
          metaCache.image = imageUrl;
        } else {
          // In multi mode, imageUrl was updated to the first image's CID before this
          metaCache.image = imageUrl;
        }
        localStorage.setItem(
          `cauldron_meta_${deployedCollection.toLowerCase()}`,
          JSON.stringify(metaCache)
        );
      } catch {}
    }
  }, [isSuccess, deployedCollection]);

  if (isSuccess) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="glass-card p-10 text-center space-y-6">
          <div className="w-20 h-20 mx-auto rounded-3xl flex items-center justify-center font-display font-black text-3xl"
            style={{ background: "rgba(200,247,197,0.1)", color: "var(--mint)" }}>
            &#10003;
          </div>
          <h2 className="font-display font-black text-3xl" style={{ color: "var(--mint)" }}>COLLECTION DEPLOYED</h2>
          <p className="text-sm" style={{ color: "rgba(200,247,197,0.4)" }}>
            &quot;{name}&quot; is now live on-chain.
          </p>
          {deployedCollection && (
            <div className="p-3 rounded-xl font-mono text-xs break-all" style={{ background: "rgba(200,247,197,0.04)", color: "rgba(200,247,197,0.4)" }}>
              {deployedCollection}
            </div>
          )}
          <div className="flex gap-3 justify-center flex-wrap">
            {deployedCollection && (
              <Link href={`/mint/${deployedCollection}`}
                className="btn-primary text-sm px-6 py-3 font-black">
                VIEW MINT PAGE
              </Link>
            )}
            <Link href="/collections/my" className="btn-secondary text-sm px-6 py-3 font-bold">
              MY COLLECTIONS
            </Link>
            <a href={`https://explorer.ritualfoundation.org/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
              className="btn-secondary text-sm px-6 py-3 font-bold">
              EXPLORER
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto">
      {/* Progress bar */}
      <div className="flex items-center gap-1 mb-10">
        {STEPS.map((s, i) => (
          <div key={s.num} className="flex items-center flex-1">
            <button onClick={() => s.num < step ? setStep(s.num as Step) : undefined}
              className="flex items-center gap-2 text-xs font-black tracking-wider transition-all"
              style={{ color: step >= s.num ? "var(--mint)" : "rgba(200,247,197,0.15)", cursor: s.num < step ? "pointer" : "default" }}>
              <div className="w-8 h-8 rounded-xl flex items-center justify-center text-xs font-black transition-all"
                style={{
                  background: step >= s.num ? "rgba(200,247,197,0.12)" : "rgba(200,247,197,0.03)",
                  color: step >= s.num ? "var(--mint)" : "rgba(200,247,197,0.15)",
                  border: step === s.num ? "1px solid rgba(200,247,197,0.3)" : "1px solid transparent",
                }}>
                {s.num}
              </div>
              <span className="hidden sm:inline">{s.label}</span>
            </button>
            {i < STEPS.length - 1 && (
              <div className="flex-1 h-px mx-3" style={{ background: step > s.num ? "rgba(200,247,197,0.2)" : "rgba(200,247,197,0.05)" }} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div className="glass-card p-8 animate-fade-in">
        {step === 1 && <Step1 collectionType={collectionType} setCollectionType={setCollectionType} />}
        {step === 2 && <Step2 name={name} setName={setName} symbol={symbol} setSymbol={setSymbol} imageUrl={imageUrl} setImageUrl={setImageUrl} imagePreview={imagePreview} imageUploading={imageUploading} handleImageUpload={handleImageUpload} description={description} setDescription={setDescription} maxSupply={maxSupply} setMaxSupply={setMaxSupply} contractType={contractType} setContractType={setContractType} imageMode={imageMode} setImageMode={setImageMode} multiImages={multiImages} setMultiImages={setMultiImages} coverMode={coverMode} setCoverMode={setCoverMode} coverIndex={coverIndex} setCoverIndex={setCoverIndex} coverFile={coverFile} setCoverFile={setCoverFile} coverPreview={coverPreview} setCoverPreview={setCoverPreview} coverCid={coverCid} setCoverCid={setCoverCid} />}
        {step === 3 && <Step3 royaltyFee={royaltyFee} setRoyaltyFee={setRoyaltyFee} royaltyRecipient={royaltyRecipient} setRoyaltyRecipient={setRoyaltyRecipient} address={address || ""} />}
        {step === 4 && <Step4 mintDate={mintDate} setMintDate={setMintDate} mintTime={mintTime} setMintTime={setMintTime} gtdEnabled={gtdEnabled} setGtdEnabled={setGtdEnabled} gtdPrice={gtdPrice} setGtdPrice={setGtdPrice} gtdMax={gtdMax} setGtdMax={setGtdMax} gtdDurHours={gtdDurHours} setGtdDurHours={setGtdDurHours} pubPrice={pubPrice} setPubPrice={setPubPrice} pubMax={pubMax} setPubMax={setPubMax} pubDurHours={pubDurHours} setPubDurHours={setPubDurHours} allowlistCSV={allowlistCSV} setAllowlistCSV={setAllowlistCSV} merkleRoot={merkleRoot} handleMerkle={handleMerkle} handleCSVUpload={handleCSVUpload} csvFile={csvFile} getScheduleLabel={getScheduleLabel} />}
        {step === 5 && <Step5 name={name} symbol={symbol} imageUrl={imageUrl} description={description} maxSupply={maxSupply} contractType={contractType} collectionType={collectionType} royaltyFee={royaltyFee} royaltyRecipient={royaltyRecipient || address || ""} gtdEnabled={gtdEnabled} gtdPrice={gtdPrice} gtdDurHours={gtdDurHours} pubPrice={pubPrice} pubDurHours={pubDurHours} merkleRoot={merkleRoot} getScheduleLabel={getScheduleLabel} imageMode={imageMode} multiImages={multiImages} />}
      </div>

      {/* Navigation */}
      <div className="flex justify-between mt-6">
        <button onClick={() => setStep((step - 1) as Step)} disabled={step === 1}
          className="btn-secondary px-8 py-3 text-sm font-black"
          style={{ opacity: step === 1 ? 0.3 : 1 }}>
          BACK
        </button>
        {step < 5 ? (
          <button onClick={() => setStep((step + 1) as Step)} disabled={!canNext()}
            className="btn-primary px-8 py-3 text-sm font-black">
            NEXT
          </button>
        ) : (
          <button onClick={handleDeploy} disabled={!name || !symbol || isPending || isConfirming || !!uploadProgress}
            className="btn-primary px-10 py-3 text-sm font-black">
            {uploadProgress || (isPending ? "CONFIRM IN WALLET..." : isConfirming ? "DEPLOYING..." : mintDate && mintTime ? "DEPLOY (PREMINT)" : "DEPLOY NOW")}
          </button>
        )}
      </div>
    </div>
  );
}

/* ══════════════ STEP COMPONENTS ══════════════ */

function Step1({ collectionType, setCollectionType }: { collectionType: string; setCollectionType: (v: "erc721a" | "erc1155") => void }) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-black text-2xl" style={{ color: "var(--mint)" }}>COLLECTION TYPE</h2>
        <p className="text-xs mt-1" style={{ color: "rgba(200,247,197,0.3)" }}>Choose the architecture for your collection</p>
      </div>
      <div className="grid md:grid-cols-2 gap-4">
        <TypeCard active={collectionType === "erc721a"} onClick={() => setCollectionType("erc721a")}
          title="SCHEDULED DROP" subtitle="ERC-721A"
          features={["Gas-efficient batch minting", "Phased launches with allowlists", "Unique 1/1 tokens", "Best for PFPs and editions"]} />
        <TypeCard active={collectionType === "erc1155"} onClick={() => setCollectionType("erc1155")}
          title="OPEN COLLECTION" subtitle="ERC-1155"
          features={["Multiple editions per item", "Lower gas per mint", "Ongoing series support", "Best for music and art"]}
          badge="COMING SOON" />
      </div>
    </div>
  );
}

function TypeCard({ active, onClick, title, subtitle, features, badge }: { active: boolean; onClick: () => void; title: string; subtitle: string; features: string[]; badge?: string }) {
  const disabled = !!badge;
  return (
    <button onClick={disabled ? undefined : onClick} className="text-left p-6 rounded-2xl transition-all relative"
      style={{
        background: active ? "rgba(200,247,197,0.08)" : "rgba(200,247,197,0.02)",
        border: `2px solid ${active ? "rgba(200,247,197,0.3)" : "rgba(200,247,197,0.06)"}`,
        opacity: disabled ? 0.4 : 1, cursor: disabled ? "not-allowed" : "pointer",
      }}>
      {badge && <span className="absolute top-4 right-4 text-[9px] font-black tracking-widest px-2 py-1 rounded-lg" style={{ background: "rgba(200,247,197,0.08)", color: "rgba(200,247,197,0.4)" }}>{badge}</span>}
      <h3 className="font-display font-black text-lg" style={{ color: "var(--mint)" }}>{title}</h3>
      <p className="text-xs font-mono mb-4" style={{ color: "rgba(200,247,197,0.25)" }}>{subtitle}</p>
      <ul className="space-y-2">
        {features.map(f => (
          <li key={f} className="text-xs flex items-center gap-2" style={{ color: "rgba(200,247,197,0.4)" }}>
            <span className="w-1 h-1 rounded-full" style={{ background: active ? "var(--mint)" : "rgba(200,247,197,0.15)" }} />
            {f}
          </li>
        ))}
      </ul>
    </button>
  );
}

function Step2({ name, setName, symbol, setSymbol, imageUrl, setImageUrl, imagePreview, imageUploading, handleImageUpload, description, setDescription, maxSupply, setMaxSupply, contractType, setContractType, imageMode, setImageMode, multiImages, setMultiImages, coverMode, setCoverMode, coverIndex, setCoverIndex, coverFile, setCoverFile, coverPreview, setCoverPreview, coverCid, setCoverCid }: any) {
  const [dragOver, setDragOver] = useState(false);

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    if (imageMode === "single") {
      const file = e.dataTransfer.files[0];
      if (file && file.type.startsWith("image/")) handleImageUpload(file);
    } else {
      const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith("image/"));
      addMultiImages(files);
    }
  }

  function addMultiImages(files: File[]) {
    const newImages = files.map(f => ({ file: f, preview: URL.createObjectURL(f) }));
    setMultiImages((prev: any[]) => [...prev, ...newImages]);
  }

  function removeMultiImage(index: number) {
    setMultiImages((prev: any[]) => prev.filter((_: any, i: number) => i !== index));
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-black text-2xl" style={{ color: "var(--mint)" }}>COLLECTION DETAILS</h2>
        <p className="text-xs mt-1" style={{ color: "rgba(200,247,197,0.3)" }}>Configure the core identity of your collection</p>
      </div>

      {/* Image Mode Toggle */}
      <div>
        <label className="block text-xs font-bold tracking-widest mb-3" style={{ color: "rgba(200,247,197,0.4)" }}>IMAGE TYPE</label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: "single", title: "SINGLE IMAGE", desc: "One image for all NFTs in the collection" },
            { key: "multi", title: "UNIQUE IMAGES", desc: "Each NFT gets its own unique image" },
          ].map(opt => (
            <button key={opt.key} onClick={() => setImageMode(opt.key)}
              className="text-left p-4 rounded-xl transition-all"
              style={{
                background: imageMode === opt.key ? "rgba(200,247,197,0.08)" : "rgba(200,247,197,0.02)",
                border: `2px solid ${imageMode === opt.key ? "rgba(200,247,197,0.3)" : "rgba(200,247,197,0.06)"}`,
              }}>
              <div className="font-black text-sm" style={{ color: imageMode === opt.key ? "var(--mint)" : "rgba(200,247,197,0.3)" }}>{opt.title}</div>
              <div className="text-[10px] mt-1" style={{ color: "rgba(200,247,197,0.2)" }}>{opt.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Single Image Upload */}
      {imageMode === "single" && (
        <div>
          <label className="block text-xs font-bold tracking-widest mb-2" style={{ color: "rgba(200,247,197,0.4)" }}>COLLECTION IMAGE</label>
          <div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={onDrop}
            className="relative rounded-2xl overflow-hidden transition-all cursor-pointer"
            style={{ border: `2px dashed ${dragOver ? "var(--mint)" : "rgba(200,247,197,0.15)"}`, background: dragOver ? "rgba(200,247,197,0.06)" : "rgba(200,247,197,0.02)", minHeight: imagePreview ? "auto" : "160px" }}
            onClick={() => document.getElementById("img-upload")?.click()}>
            {imagePreview ? (
              <div className="relative">
                <img src={imagePreview} alt="Preview" className="w-full max-h-64 object-cover" />
                <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity" style={{ background: "rgba(4,15,10,0.7)" }}>
                  <span className="text-xs font-black tracking-widest" style={{ color: "var(--mint)" }}>CHANGE IMAGE</span>
                </div>
                {imageUploading && <div className="absolute bottom-0 left-0 right-0 p-3 text-center text-xs font-bold" style={{ background: "rgba(4,15,10,0.85)", color: "var(--mint)" }}>Uploading to IPFS...</div>}
                {imageUrl && !imageUploading && <div className="absolute bottom-0 left-0 right-0 p-2 text-center text-[10px] font-mono" style={{ background: "rgba(4,15,10,0.85)", color: "rgba(200,247,197,0.4)" }}>{imageUrl.slice(0, 40)}...</div>}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 gap-3">
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black" style={{ background: "rgba(200,247,197,0.05)", color: "rgba(200,247,197,0.2)" }}>+</div>
                <p className="text-xs font-bold" style={{ color: "rgba(200,247,197,0.3)" }}>Drop image here or click to upload</p>
                <p className="text-[10px]" style={{ color: "rgba(200,247,197,0.15)" }}>PNG, JPG, GIF, SVG or WEBP</p>
              </div>
            )}
            <input id="img-upload" type="file" accept="image/*" className="hidden" onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImageUpload(f); }} />
          </div>
          <details className="mt-2">
            <summary className="text-[10px] cursor-pointer" style={{ color: "rgba(200,247,197,0.2)" }}>Or paste IPFS URL manually</summary>
            <input className="input-field mt-2 text-xs" placeholder="ipfs://Qm..." value={imageUrl} onChange={(e: any) => setImageUrl(e.target.value)} />
          </details>
        </div>
      )}

      {/* Multi Image Upload */}
      {imageMode === "multi" && (
        <div>
          <label className="block text-xs font-bold tracking-widest mb-2" style={{ color: "rgba(200,247,197,0.4)" }}>
            NFT IMAGES <span className="font-mono" style={{ color: "rgba(200,247,197,0.2)" }}>({multiImages.length} uploaded → supply = {multiImages.length})</span>
          </label>
          <div onDragOver={(e) => { e.preventDefault(); setDragOver(true); }} onDragLeave={() => setDragOver(false)} onDrop={onDrop}
            className="rounded-2xl transition-all p-4"
            style={{ border: `2px dashed ${dragOver ? "var(--mint)" : "rgba(200,247,197,0.15)"}`, background: dragOver ? "rgba(200,247,197,0.06)" : "rgba(200,247,197,0.02)", minHeight: multiImages.length > 0 ? "auto" : "160px" }}>
            {multiImages.length > 0 ? (
              <div className="grid grid-cols-4 gap-3">
                {multiImages.map((img: any, i: number) => (
                  <div key={i} className="relative group rounded-xl overflow-hidden aspect-square" style={{ border: "1px solid rgba(200,247,197,0.1)" }}>
                    <img src={img.preview} alt={`#${i + 1}`} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "rgba(4,15,10,0.7)" }}>
                      <button onClick={() => removeMultiImage(i)} className="w-8 h-8 rounded-lg flex items-center justify-center text-sm font-black" style={{ background: "rgba(255,120,120,0.2)", color: "rgba(255,120,120,0.8)" }}>×</button>
                    </div>
                    <div className="absolute bottom-1 left-1 px-1.5 py-0.5 rounded text-[9px] font-black" style={{ background: "rgba(4,15,10,0.8)", color: "var(--mint)" }}>#{i + 1}</div>
                  </div>
                ))}
                <button onClick={() => document.getElementById("multi-img-upload")?.click()}
                  className="rounded-xl aspect-square flex flex-col items-center justify-center gap-1 transition-all hover:scale-105"
                  style={{ border: "2px dashed rgba(200,247,197,0.1)", background: "rgba(200,247,197,0.02)" }}>
                  <span className="text-lg font-black" style={{ color: "rgba(200,247,197,0.2)" }}>+</span>
                  <span className="text-[9px] font-bold" style={{ color: "rgba(200,247,197,0.15)" }}>ADD</span>
                </button>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-8 gap-3" onClick={() => document.getElementById("multi-img-upload")?.click()}>
                <div className="w-12 h-12 rounded-xl flex items-center justify-center text-lg font-black" style={{ background: "rgba(200,247,197,0.05)", color: "rgba(200,247,197,0.2)" }}>+</div>
                <p className="text-xs font-bold" style={{ color: "rgba(200,247,197,0.3)" }}>Drop multiple images or click to select</p>
                <p className="text-[10px]" style={{ color: "rgba(200,247,197,0.15)" }}>Each image becomes a unique NFT in your collection</p>
              </div>
            )}
          </div>
          <input id="multi-img-upload" type="file" accept="image/*" multiple className="hidden" onChange={(e) => { const files = Array.from(e.target.files || []); if (files.length) addMultiImages(files); }} />
        </div>
      )}

      {/* Cover Art Picker — only in multi mode with images uploaded */}
      {imageMode === "multi" && multiImages.length > 0 && (
        <div>
          <label className="block text-xs font-bold tracking-widest mb-3" style={{ color: "rgba(200,247,197,0.4)" }}>COVER ART</label>
          <div className="grid grid-cols-3 gap-3 mb-3">
            {[
              { key: "first", title: "FIRST IMAGE", desc: "Use your 1st uploaded art" },
              { key: "pick", title: "PICK FROM ARTS", desc: "Click any art below to select" },
              { key: "custom", title: "UPLOAD COVER", desc: "Upload a separate cover image" },
            ].map(opt => (
              <button key={opt.key} onClick={() => setCoverMode(opt.key)}
                className="text-left p-3 rounded-xl transition-all"
                style={{
                  background: coverMode === opt.key ? "rgba(200,247,197,0.08)" : "rgba(200,247,197,0.02)",
                  border: `2px solid ${coverMode === opt.key ? "rgba(200,247,197,0.3)" : "rgba(200,247,197,0.06)"}`,
                }}>
                <div className="font-black text-[10px]" style={{ color: coverMode === opt.key ? "var(--mint)" : "rgba(200,247,197,0.3)" }}>{opt.title}</div>
                <div className="text-[9px] mt-0.5" style={{ color: "rgba(200,247,197,0.2)" }}>{opt.desc}</div>
              </button>
            ))}
          </div>

          {/* Show selected cover preview */}
          {coverMode === "first" && (
            <div className="flex items-center gap-3 p-3 rounded-xl" style={{ background: "rgba(200,247,197,0.03)", border: "1px solid rgba(200,247,197,0.08)" }}>
              <div className="w-16 h-16 rounded-lg overflow-hidden flex-shrink-0">
                <img src={multiImages[0]?.preview} alt="Cover" className="w-full h-full object-cover" />
              </div>
              <div>
                <div className="text-xs font-bold" style={{ color: "var(--mint)" }}>Using image #1 as cover</div>
                <div className="text-[10px] mt-0.5" style={{ color: "rgba(200,247,197,0.2)" }}>This will be the thumbnail shown on collection cards</div>
              </div>
            </div>
          )}

          {coverMode === "pick" && (
            <div>
              <p className="text-[10px] mb-2" style={{ color: "rgba(200,247,197,0.25)" }}>Click an image to select it as your cover art:</p>
              <div className="grid grid-cols-5 gap-2">
                {multiImages.map((img: any, i: number) => (
                  <button key={i} onClick={() => setCoverIndex(i)}
                    className="relative rounded-lg overflow-hidden aspect-square transition-all"
                    style={{ border: `3px solid ${coverIndex === i ? "var(--mint)" : "rgba(200,247,197,0.08)"}`, opacity: coverIndex === i ? 1 : 0.6 }}>
                    <img src={img.preview} alt={`#${i + 1}`} className="w-full h-full object-cover" />
                    {coverIndex === i && (
                      <div className="absolute inset-0 flex items-center justify-center" style={{ background: "rgba(4,15,10,0.4)" }}>
                        <span className="text-[10px] font-black px-2 py-0.5 rounded-lg" style={{ background: "var(--mint)", color: "var(--bg)" }}>COVER</span>
                      </div>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}

          {coverMode === "custom" && (
            <div className="rounded-xl overflow-hidden cursor-pointer transition-all"
              style={{ border: "2px dashed rgba(200,247,197,0.15)", background: "rgba(200,247,197,0.02)" }}
              onClick={() => document.getElementById("cover-upload")?.click()}>
              {coverPreview ? (
                <div className="relative">
                  <img src={coverPreview} alt="Custom cover" className="w-full max-h-48 object-cover" />
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity" style={{ background: "rgba(4,15,10,0.7)" }}>
                    <span className="text-xs font-black tracking-widest" style={{ color: "var(--mint)" }}>CHANGE COVER</span>
                  </div>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center py-8 gap-2">
                  <div className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-black" style={{ background: "rgba(200,247,197,0.05)", color: "rgba(200,247,197,0.2)" }}>🖼</div>
                  <p className="text-xs font-bold" style={{ color: "rgba(200,247,197,0.3)" }}>Upload a custom cover image</p>
                  <p className="text-[10px]" style={{ color: "rgba(200,247,197,0.15)" }}>This won't be part of the NFT collection</p>
                </div>
              )}
              <input id="cover-upload" type="file" accept="image/*" className="hidden" onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  setCoverFile(f);
                  setCoverPreview(URL.createObjectURL(f));
                  setCoverCid(""); // reset CID so it uploads fresh on deploy
                }
              }} />
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <Field label="COLLECTION NAME" value={name} onChange={setName} placeholder="The Cauldron Genesis" required />
        <Field label="TOKEN SYMBOL" value={symbol} onChange={setSymbol} placeholder="CLDN" required />
      </div>

      <div>
        <label className="block text-xs font-bold tracking-widest mb-2" style={{ color: "rgba(200,247,197,0.4)" }}>DESCRIPTION</label>
        <textarea className="input-field h-28 resize-none text-sm" placeholder="Describe your collection..." value={description} onChange={e => setDescription(e.target.value)} />
      </div>

      {imageMode === "single" && <Field label="MAX SUPPLY" value={maxSupply} onChange={setMaxSupply} type="number" />}
      {imageMode === "multi" && (
        <div className="p-4 rounded-2xl" style={{ background: "rgba(200,247,197,0.03)", border: "1px solid rgba(200,247,197,0.06)" }}>
          <div className="flex items-center justify-between">
            <span className="text-xs font-bold tracking-widest" style={{ color: "rgba(200,247,197,0.3)" }}>MAX SUPPLY</span>
            <span className="font-display font-black text-xl" style={{ color: "var(--mint)" }}>{multiImages.length}</span>
          </div>
          <p className="text-[10px] mt-1" style={{ color: "rgba(200,247,197,0.2)" }}>Automatically set to match your uploaded images</p>
        </div>
      )}

      <div>
        <label className="block text-xs font-bold tracking-widest mb-3" style={{ color: "rgba(200,247,197,0.4)" }}>CONTRACT TYPE</label>
        <div className="grid grid-cols-2 gap-3">
          {[
            { key: "proxy", label: "PROXY (EIP-1167)", desc: "Cheaper to deploy, standard mint cost" },
            { key: "standard", label: "STANDARD", desc: "Higher deploy cost, cheaper minting" },
          ].map(c => (
            <button key={c.key} onClick={() => setContractType(c.key)}
              className="text-left p-4 rounded-xl transition-all"
              style={{
                background: contractType === c.key ? "rgba(200,247,197,0.08)" : "rgba(200,247,197,0.02)",
                border: `1px solid ${contractType === c.key ? "rgba(200,247,197,0.2)" : "rgba(200,247,197,0.06)"}`,
              }}>
              <div className="text-xs font-black" style={{ color: contractType === c.key ? "var(--mint)" : "rgba(200,247,197,0.3)" }}>{c.label}</div>
              <div className="text-[10px] mt-1" style={{ color: "rgba(200,247,197,0.2)" }}>{c.desc}</div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}


function Step3({ royaltyFee, setRoyaltyFee, royaltyRecipient, setRoyaltyRecipient, address }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-black text-2xl" style={{ color: "var(--mint)" }}>CREATOR EARNINGS</h2>
        <p className="text-xs mt-1" style={{ color: "rgba(200,247,197,0.3)" }}>Set your royalty on secondary sales (enforced on-chain via ERC-2981)</p>
      </div>

      <div>
        <label className="block text-xs font-bold tracking-widest mb-2" style={{ color: "rgba(200,247,197,0.4)" }}>ROYALTY PERCENTAGE</label>
        <div className="flex items-center gap-4">
          <input type="range" min="0" max="10" step="0.5" value={royaltyFee} onChange={e => setRoyaltyFee(e.target.value)}
            className="flex-1 accent-[#c8f7c5]" />
          <div className="w-16 text-center font-display font-black text-2xl" style={{ color: "var(--mint)" }}>{royaltyFee}%</div>
        </div>
        <div className="flex justify-between text-[10px] mt-1 px-1" style={{ color: "rgba(200,247,197,0.15)" }}>
          <span>0%</span><span>10%</span>
        </div>
      </div>

      <Field label="RECIPIENT WALLET" value={royaltyRecipient} onChange={setRoyaltyRecipient} placeholder={address || "0x..."} />
      <p className="text-[10px]" style={{ color: "rgba(200,247,197,0.2)" }}>Leave empty to use your connected wallet</p>

      <div className="p-4 rounded-2xl" style={{ background: "rgba(200,247,197,0.03)", border: "1px solid rgba(200,247,197,0.06)" }}>
        <div className="text-xs font-bold tracking-widest mb-2" style={{ color: "rgba(200,247,197,0.3)" }}>ENFORCEMENT</div>
        <p className="text-xs" style={{ color: "rgba(200,247,197,0.4)" }}>
          Royalties are enforced on-chain via ERC-2981. The Cauldron marketplace automatically splits payments to respect your configured royalty.
        </p>
      </div>
    </div>
  );
}

function Step4({ mintDate, setMintDate, mintTime, setMintTime, gtdEnabled, setGtdEnabled, gtdPrice, setGtdPrice, gtdMax, setGtdMax, gtdDurHours, setGtdDurHours, pubPrice, setPubPrice, pubMax, setPubMax, pubDurHours, setPubDurHours, allowlistCSV, setAllowlistCSV, merkleRoot, handleMerkle, handleCSVUpload, csvFile, getScheduleLabel }: any) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-black text-2xl" style={{ color: "var(--mint)" }}>MINT SCHEDULE</h2>
        <p className="text-xs mt-1" style={{ color: "rgba(200,247,197,0.3)" }}>Configure when and how minting happens</p>
      </div>

      {/* Schedule */}
      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-bold tracking-widest mb-2" style={{ color: "rgba(200,247,197,0.4)" }}>START DATE</label>
          <input className="input-field" type="date" value={mintDate} onChange={(e: any) => setMintDate(e.target.value)} style={{ colorScheme: "dark" }} />
        </div>
        <div>
          <label className="block text-xs font-bold tracking-widest mb-2" style={{ color: "rgba(200,247,197,0.4)" }}>START TIME</label>
          <input className="input-field" type="time" value={mintTime} onChange={(e: any) => setMintTime(e.target.value)} style={{ colorScheme: "dark" }} />
        </div>
      </div>
      <div className="px-4 py-2.5 rounded-xl text-xs font-bold" style={{ background: "rgba(200,247,197,0.04)", color: "rgba(200,247,197,0.5)" }}>
        {getScheduleLabel()}
      </div>

      <div className="divider" />

      {/* Phase 1 Toggle */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="font-display font-black text-sm tracking-widest" style={{ color: gtdEnabled ? "rgba(200,247,197,0.5)" : "rgba(200,247,197,0.2)" }}>PHASE 1 — ALLOWLIST</h3>
          <p className="text-[10px] mt-0.5" style={{ color: "rgba(200,247,197,0.2)" }}>Enable to add a private allowlist phase before public sale</p>
        </div>
        <button onClick={() => setGtdEnabled(!gtdEnabled)}
          className="relative w-12 h-6 rounded-full transition-all"
          style={{ background: gtdEnabled ? "rgba(200,247,197,0.25)" : "rgba(200,247,197,0.06)" }}>
          <div className="absolute top-1 w-4 h-4 rounded-full transition-all"
            style={{ background: gtdEnabled ? "var(--mint)" : "rgba(200,247,197,0.15)", left: gtdEnabled ? "26px" : "4px" }} />
        </button>
      </div>

      {gtdEnabled && (
        <>
          <div className="grid grid-cols-3 gap-3">
            <Field label="PRICE (RITUAL)" value={gtdPrice} onChange={setGtdPrice} type="number" />
            <Field label="MAX/WALLET" value={gtdMax} onChange={setGtdMax} type="number" />
            <Field label="DURATION (HRS)" value={gtdDurHours} onChange={setGtdDurHours} type="number" />
          </div>

          {/* Allowlist */}
          <div>
            <label className="block text-xs font-bold tracking-widest mb-2" style={{ color: "rgba(200,247,197,0.4)" }}>ALLOWLIST</label>
            <div className="flex gap-3 mb-2">
              <label className="btn-secondary text-xs px-4 py-2 cursor-pointer">
                UPLOAD CSV
                <input type="file" accept=".csv" className="hidden" onChange={handleCSVUpload} />
              </label>
              <button className="btn-secondary text-xs px-4 py-2" onClick={handleMerkle} disabled={!allowlistCSV}>GENERATE ROOT</button>
              {csvFile && <span className="text-xs self-center" style={{ color: "rgba(200,247,197,0.3)" }}>{csvFile}</span>}
            </div>
            <textarea className="input-field h-16 resize-none font-mono text-xs" placeholder={"0xABC...\n0xDEF... (or upload CSV)"} value={allowlistCSV} onChange={(e: any) => setAllowlistCSV(e.target.value)} />
            {merkleRoot !== zeroHash && <p className="text-xs mt-1 font-mono break-all" style={{ color: "rgba(200,247,197,0.4)" }}>Root: {merkleRoot.slice(0, 24)}...</p>}
          </div>
        </>
      )}

      <div className="divider" />

      {/* Phase 2 */}
      <h3 className="font-display font-black text-sm tracking-widest" style={{ color: "rgba(200,247,197,0.5)" }}>{gtdEnabled ? "PHASE 2 — PUBLIC SALE" : "PUBLIC SALE"}</h3>
      <div className="grid grid-cols-3 gap-3">
        <Field label="PRICE (RITUAL)" value={pubPrice} onChange={setPubPrice} type="number" />
        <Field label="MAX/WALLET" value={pubMax} onChange={setPubMax} type="number" />
        <Field label="DURATION (HRS)" value={pubDurHours} onChange={setPubDurHours} type="number" />
      </div>
    </div>
  );
}

function Step5({ name, symbol, imageUrl, description, maxSupply, contractType, collectionType, royaltyFee, royaltyRecipient, gtdEnabled, gtdPrice, gtdDurHours, pubPrice, pubDurHours, merkleRoot, getScheduleLabel, imageMode, multiImages }: any) {
  const displaySupply = imageMode === "multi" ? String(multiImages?.length || 0) : maxSupply;
  return (
    <div className="space-y-6">
      <div>
        <h2 className="font-display font-black text-2xl" style={{ color: "var(--mint)" }}>REVIEW &amp; DEPLOY</h2>
        <p className="text-xs mt-1" style={{ color: "rgba(200,247,197,0.3)" }}>Verify everything before deploying on-chain</p>
      </div>

      <div className="space-y-3">
        <ReviewRow label="Collection" value={`${name} (${symbol})`} />
        <ReviewRow label="Type" value={collectionType === "erc721a" ? "ERC-721A Scheduled Drop" : "ERC-1155 Open Collection"} />
        <ReviewRow label="Contract" value={contractType === "proxy" ? "Proxy (EIP-1167)" : "Standard"} />
        <ReviewRow label="Supply" value={displaySupply} />
        {imageMode === "multi" && <ReviewRow label="Images" value={`${multiImages?.length || 0} unique`} />}
        {description && <ReviewRow label="Description" value={description.slice(0, 80) + (description.length > 80 ? "..." : "")} />}
        {imageUrl && <ReviewRow label="Image" value={imageUrl.slice(0, 40) + "..."} />}
        <div className="divider" />
        <ReviewRow label="Royalty" value={`${royaltyFee}%`} />
        <ReviewRow label="Recipient" value={`${royaltyRecipient.slice(0, 10)}...${royaltyRecipient.slice(-6)}`} />
        <div className="divider" />
        <ReviewRow label="Schedule" value={getScheduleLabel()} />
        {gtdEnabled && <ReviewRow label="Allowlist Phase" value={`${gtdDurHours}h at ${gtdPrice} RITUAL`} />}
        <ReviewRow label="Public Phase" value={`${pubDurHours}h at ${pubPrice} RITUAL`} />
        <ReviewRow label="Total Window" value={`${(gtdEnabled ? parseFloat(gtdDurHours) + parseFloat(pubDurHours) : parseFloat(pubDurHours)).toFixed(1)}h`} />
        {gtdEnabled && <ReviewRow label="Merkle Root" value={merkleRoot !== zeroHash ? "Configured" : "None (open allowlist)"} />}
      </div>
    </div>
  );
}

function ReviewRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center py-2 px-1">
      <span className="text-xs font-bold tracking-wider" style={{ color: "rgba(200,247,197,0.3)" }}>{label}</span>
      <span className="text-sm font-bold" style={{ color: "var(--mint)" }}>{value}</span>
    </div>
  );
}

function Field({ label, value, onChange, placeholder, type, required }: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="block text-xs font-bold tracking-widest mb-2" style={{ color: "rgba(200,247,197,0.4)" }}>
        {label}{required && <span style={{ color: "rgba(255,120,120,0.5)" }}> *</span>}
      </label>
      <input className="input-field" type={type || "text"} placeholder={placeholder} value={value} onChange={e => onChange(e.target.value)} />
    </div>
  );
}
