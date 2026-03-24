import JSZip from "jszip";
import yaml from "js-yaml";
import { cleanupBlobUrls, base64ToBlob, resizeImageToBlob } from "../utils/ImageUtils";

// Function to get images that contain annotations of a specific class
export const getImagesWithClass = (classId, images) => {
  return images.filter(
    (image) =>
      image.annotations &&
      image.annotations.some((annotation) => annotation.classId === classId)
  );
};

// Handle individual image uploads to current split
export const handleIndividualImageUpload = async (
  imageFiles,
  images,
  setImages,
  dataset,
  setDataset,
  setIsZipDataset,
  datasetSplit
) => {
  try {
    const validImageFiles = imageFiles.filter(
      (file) =>
        file.type.startsWith("image/") ||
        /\.(jpg|jpeg|png|gif)$/i.test(file.name)
    );

    if (validImageFiles.length === 0) {
      return;
    }

    // Process each image file
    const newImages = [];
    for (const file of validImageFiles) {
      const reader = new FileReader();
      const imageData = await new Promise((resolve) => {
        reader.onload = (e) => resolve(e.target.result);
        reader.readAsDataURL(file);
      });

      newImages.push({
        id: images.length + newImages.length,
        name: file.name,
        src: imageData,
        annotations: [],
        split: datasetSplit || "train", // Default to train if not provided
      });
    }

    // Add new images to the current split
    const updatedImages = [...images, ...newImages];
    setImages(updatedImages);

    // If no dataset was previously loaded, create a basic one
    if (!dataset) {
      // Create a simple dataset object
      const dummyDataset = {
        name: "Manual Dataset",
        size: updatedImages.length,
      };
      setDataset(dummyDataset);
      if (setIsZipDataset) setIsZipDataset(true);
    }
  } catch (error) {
    console.error("Error adding images:", error);
  }
};

export const onDrop = async (
  acceptedFiles,
  imageFiles,
  images,
  setImages,
  dataset,
  setDataset,
  setDatasetConfig,
  setClasses,
  setSelectedClass,
  setAvailableSplits,
  availableSplits,
  setModifiedImages,
  setIsZipDataset,
  datasetSplit,
  setDatasetSplit,
  setAnnotations,
  setCurrentImageIndex,
  setLoadingProgress,
  setLoadingCancelled,
  loadingCancelled,
  blobUrlsRef,
  checkMemory,
  setSelectedAnnotation,
  setNewAnnotation,
  setEditingAnnotation,
  setHoveredAnnotation,
  setSelectedAnnotations,
  setScale,
  setStagePos,
  setDatasetType
) => {
  try {
    console.log("onDrop CALLED! acceptedFiles:", acceptedFiles);
    // Check if we're adding individual images to an existing dataset
    if (
      dataset &&
      acceptedFiles.length > 0 &&
      !acceptedFiles[0].name.endsWith(".zip")
    ) {
      // Handle individual image uploads
      await handleIndividualImageUpload(
        imageFiles,
        images,
        setImages,
        dataset,
        setDataset,
        setIsZipDataset
      );
      return;
    }

    // If no dataset is loaded and we have a ZIP file, load the dataset
    if (
      !dataset &&
      acceptedFiles.length > 0 &&
      acceptedFiles[0].name.endsWith(".zip")
    ) {
      const file = acceptedFiles[0];
      console.log("ZIP Upload: File name:", file.name);
      if (!file.name.endsWith(".zip")) {
        return;
      }

      const zip = new JSZip();
      const content = await zip.loadAsync(file);
      console.log(
        "ZIP Upload: ZIP loaded. Total files/folders:",
        Object.keys(content.files).length
      );
      console.log(
        "ZIP Upload: Content keys:",
        Object.keys(content.files).slice(0, 20)
      ); // Show first 20

      // CHECK FOR ROOT FOLDER (e.g., segmentation-dataset/)
      let zipContent = content;
      const rootFolders = Object.keys(content.files)
        .filter(k => k.endsWith('/') && k.split('/').filter(Boolean).length === 1);

      if (!content.file("dataset.yaml") && rootFolders.length === 1) {
        const potentialRoot = rootFolders[0];
        console.log(`ZIP Upload: Shifted root detected: ${potentialRoot}`);
        zipContent = content.folder(potentialRoot.replace('/', ''));
      }

      // Check if the ZIP file is valid and contains files
      const fileCount = Object.keys(content.files).length;
      if (fileCount === 0) {
        console.error("ZIP Upload: ZIP is empty!");
        return;
      }

      // Extract dataset.yaml
      const configFile = zipContent.file("dataset.yaml");
      let config = null;
      console.log("ZIP Upload: Looking for dataset.yaml...");
      if (configFile) {
        console.log("ZIP Upload: dataset.yaml found!");
        try {
          const configText = await configFile.async("text");
          config = yaml.load(configText);
          console.log("ZIP Upload: Parsed config:", config);
          setDatasetConfig(config); // Store original config
          setClasses(config.names || ["unknown"]);
          setSelectedClass(config.names?.[0] || "unknown");

          // Determine available splits from config
          const splits = [];
          if (config.train) splits.push("train");
          if (config.val) splits.push("valid");
          if (config.test) splits.push("test");

          // If no splits found in config, add default ones
          if (splits.length === 0) {
            splits.push("train");
            if (zipContent.folder("valid") || zipContent.folder("val"))
              splits.push("valid");
            if (zipContent.folder("test")) splits.push("test");
          }

          console.log("ZIP Upload: Available splits:", splits);
          setAvailableSplits(splits);
        } catch (yamlError) {
          console.error("Error parsing dataset.yaml:", yamlError);
          setAvailableSplits(["train", "valid"]);
        }
      } else {
        console.warn(
          "No dataset.yaml found in the ZIP file. Using default configuration."
        );
        setAvailableSplits(["train", "valid"]);
      }

      // Initialize modifiedImages with empty objects for each split
      const initialModifiedImages = {};
      // Use detected splits if available, otherwise default
      const effectiveSplits =
        config && (config.train || config.val || config.test)
          ? [
            config.train ? "train" : null,
            config.val ? "valid" : null,
            config.test ? "test" : null,
          ].filter(Boolean)
          : ["train", "valid", "test"];

      console.log("ZIP Upload: Effective splits:", effectiveSplits);
      effectiveSplits.forEach((split) => {
        initialModifiedImages[split] = {};
      });
      setModifiedImages(initialModifiedImages);

      // Load all splits into a single combined images list for the editor view
      console.log(
        "ZIP Upload: Starting loadDatasetAllSplits with splits:",
        effectiveSplits
      );
      await loadDatasetAllSplits(
        zipContent,
        config,
        effectiveSplits,
        initialModifiedImages,
        blobUrlsRef,
        setImages,
        setAnnotations,
        setCurrentImageIndex,
        setSelectedAnnotation,
        setNewAnnotation,
        setEditingAnnotation,
        setHoveredAnnotation,
        setSelectedAnnotations,
        checkMemory,
        setScale,
        setStagePos,
        setDatasetType
      );

      // Select the first available split to ensure images are displayed
      if (effectiveSplits.length > 0 && typeof setDatasetSplit === 'function') {
        setDatasetSplit(effectiveSplits[0]);
      }

      console.log("ZIP Upload: loadDatasetAllSplits completed");

      setDataset(file);
      setIsZipDataset(true); // Mark that this is a ZIP dataset (no API calls allowed)
      console.log(
        "ZIP Dataset loaded successfully. NO API CALLS MADE. All data from ZIP file."
      );
      return;
    }

    // If we have a dataset loaded and we're uploading a ZIP file, treat it as a new dataset
    if (
      dataset &&
      acceptedFiles.length > 0 &&
      acceptedFiles[0].name.endsWith(".zip")
    ) {
      const file = acceptedFiles[0];
      const zip = new JSZip();
      const content = await zip.loadAsync(file);

      // CHECK FOR ROOT FOLDER (e.g., segmentation-dataset/)
      let zipContent = content;
      const rootFolders = Object.keys(content.files)
        .filter(k => k.endsWith('/') && k.split('/').filter(Boolean).length === 1);

      if (!content.file("dataset.yaml") && rootFolders.length === 1) {
        const potentialRoot = rootFolders[0];
        console.log(`ZIP Upload: Shifted root detected: ${potentialRoot}`);
        zipContent = content.folder(potentialRoot.replace('/', ''));
      }

      // Extract dataset.yaml
      const configFile = zipContent.file("dataset.yaml");
      let config = null;
      if (configFile) {
        try {
          const configText = await configFile.async("text");
          config = yaml.load(configText);
          setDatasetConfig(config); // Store original config
          setClasses(config.names || ["unknown"]);
          setSelectedClass(config.names?.[0] || "unknown");

          // Determine available splits from config
          const splits = [];
          if (config.train) splits.push("train");
          if (config.val) splits.push("valid");
          if (config.test) splits.push("test");

          // If no splits found in config, add default ones
          if (splits.length === 0) {
            splits.push("train");
            if (zipContent.folder("valid") || zipContent.folder("val"))
              splits.push("valid");
            if (zipContent.folder("test")) splits.push("test");
          }

          setAvailableSplits(splits);
        } catch (yamlError) {
          console.error("Error parsing dataset.yaml:", yamlError);
          setAvailableSplits(["train", "valid"]);
        }
      }

      // Initialize modifiedImages with empty objects for each split
      const initialModifiedImages = {};
      const splits =
        availableSplits.length > 0 ? availableSplits : ["train", "valid"];
      splits.forEach((split) => {
        initialModifiedImages[split] = {};
      });
      setModifiedImages(initialModifiedImages);

      await loadDatasetAllSplits(
        zipContent,
        config,
        [datasetSplit],
        initialModifiedImages,
        blobUrlsRef,
        setImages,
        setAnnotations,
        setCurrentImageIndex,
        setSelectedAnnotation,
        setNewAnnotation,
        setEditingAnnotation,
        setHoveredAnnotation,
        setSelectedAnnotations,
        checkMemory,
        setScale,
        setStagePos,
        setDatasetType
      );

      setDataset(file);
      setIsZipDataset(true); // Mark that this is a ZIP dataset (no API calls allowed)
      console.log(
        "ZIP Dataset loaded successfully. NO API CALLS MADE. All data from ZIP file."
      );
      return;
    }

    // Handle individual image uploads when no dataset is loaded
    if (!dataset && acceptedFiles.length > 0) {
      await handleIndividualImageUpload(
        imageFiles,
        images,
        setImages,
        dataset,
        setDataset,
        setIsZipDataset
      );
      return;
    }
  } catch (error) {
    console.error("Error loading dataset:", error);
  }
};

// Load dataset for all splits and combine into a single images array for the editor view
export const loadDatasetAllSplits = async (
  content,
  config,
  splits,
  currentModifiedImages,
  blobUrlsRef,
  setImages,
  setAnnotations,
  setCurrentImageIndex,
  setSelectedAnnotation,
  setNewAnnotation,
  setEditingAnnotation,
  setHoveredAnnotation,
  setSelectedAnnotations,
  checkMemory,
  setScale,
  setStagePos,
  setDatasetType
) => {
  try {
    console.log(
      "loadDatasetAllSplits: Starting with splits:",
      splits,
      "config:",
      config
    );
    // Optimization: Don't clear everything immediately to avoid "Black Canvas" flicker
    // Images will be updated once the new batch is ready

    const combinedImages = [];
    let globalIndex = 0;

    for (const split of splits) {
      console.log(`loadDatasetAllSplits: Processing split: ${split}`);
      // Reuse split-specific loading logic but keep track of split on each image
      // Determine folder paths based on split with proper fallback
      let imageFolder, labelFolder;
      if (split === "train") {
        const trainImagePath = (config && config.train) || "train/images";
        const trainBasePath = trainImagePath.replace("/images", "");
        console.log(
          `loadDatasetAllSplits: train - looking for folders:`,
          trainBasePath,
          "train",
          "images"
        );
        imageFolder =
          content.folder(trainBasePath) ||
          content.folder("train") ||
          content.folder("images");
        labelFolder =
          content.folder(
            trainBasePath ? `${trainBasePath}/labels` : "train/labels"
          ) ||
          content.folder("train/labels") ||
          content.folder("labels");
      } else if (split === "valid") {
        const valImagePath = (config && config.val) || "valid/images";
        const valBasePath = valImagePath.replace("/images", "");
        console.log(
          `loadDatasetAllSplits: valid - looking for folders:`,
          valBasePath,
          "valid",
          "images"
        );
        imageFolder =
          content.folder(valBasePath) ||
          content.folder("valid") ||
          content.folder("images");
        labelFolder =
          content.folder(
            valBasePath ? `${valBasePath}/labels` : "valid/labels"
          ) ||
          content.folder("valid/labels") ||
          content.folder("labels");
      } else if (split === "test") {
        const testImagePath = (config && config.test) || "test/images";
        const testBasePath = testImagePath.replace("/images", "");
        console.log(
          `loadDatasetAllSplits: test - looking for folders:`,
          testBasePath,
          "test",
          "images"
        );
        imageFolder =
          content.folder(testBasePath) ||
          content.folder("test") ||
          content.folder("images");
        labelFolder =
          content.folder(
            testBasePath ? `${testBasePath}/labels` : "test/labels"
          ) ||
          content.folder("test/labels") ||
          content.folder("labels");
      } else {
        imageFolder = content.folder("train") || content.folder("images");
        labelFolder =
          content.folder("train/labels") || content.folder("labels");
      }

      console.log(
        `loadDatasetAllSplits: imageFolder found for ${split}:`,
        !!imageFolder,
        "labelFolder:",
        !!labelFolder
      );

      // Fallback search for any image folder if specific one not found
      if (!imageFolder) {
        console.warn(
          `loadDatasetAllSplits: No imageFolder found for ${split}, searching...`
        );
        const folders = Object.keys(content.files)
          .filter((key) => key.includes("/") && !key.includes("."))
          .map((key) => key.split("/")[0]);
        const uniqueFolders = [...new Set(folders)];
        console.log(
          "loadDatasetAllSplits: Unique folders found:",
          uniqueFolders
        );

        for (const folder of uniqueFolders) {
          const folderContent = content.folder(folder);
          if (
            folderContent &&
            folderContent.file(/.*\.(jpg|jpeg|png)$/i).length > 0
          ) {
            console.log(
              `loadDatasetAllSplits: Found images in folder: ${folder}`
            );
            imageFolder = folderContent;
            break;
          }
        }

        if (!imageFolder) {
          console.log("loadDatasetAllSplits: Using root as imageFolder");
          imageFolder = content;
        }

        labelFolder = content.folder("labels") || content;
      }

      if (!imageFolder) {
        console.warn(
          `loadDatasetAllSplits: No imageFolder for split ${split}, skipping`
        );
        continue;
      }

      const imageList = imageFolder.file(/.*\.(jpg|jpeg|png)$/i);
      console.log(
        `loadDatasetAllSplits: Found ${imageList.length} images in split ${split}`
      );

      if (imageList.length === 0) {
        console.warn(
          `loadDatasetAllSplits: No images found in split ${split}`
        );
        continue;
      }

      const chunkSize = 500;
      for (let i = 0; i < imageList.length; i += chunkSize) {
        const chunk = imageList.slice(
          i,
          Math.min(i + chunkSize, imageList.length)
        );

        const chunkImages = await Promise.all(
          chunk.map(async (imageFile, idx) => {
            const imageData = await imageFile.async("base64");
            const imageName = imageFile.name.split("/").pop();

            const imageKey = `${split}/${imageName}`;
            let imageAnnotations = [];

            // Prefer modified annotations if available
            if (
              currentModifiedImages[split] &&
              currentModifiedImages[split][imageKey]
            ) {
              imageAnnotations = currentModifiedImages[split][imageKey];
            } else {
              const labelFileName = imageName.replace(/\.[^/.]+$/, ".txt");
              let labelFile = labelFolder?.file(labelFileName);

              if (!labelFile && imageFile.name.includes("/")) {
                const imagePathParts = imageFile.name.split("/");
                imagePathParts.pop();
                const imageFolderPath = imagePathParts.join("/");
                const imageBaseFolder = content.folder(imageFolderPath);
                if (imageBaseFolder) {
                  const labelsFolderPath = imageFolderPath.replace(
                    "/images",
                    "/labels"
                  );
                  const labelsFolder = content.folder(labelsFolderPath);
                  labelFile =
                    labelsFolder?.file(labelFileName) ||
                    imageBaseFolder.file(labelFileName);
                }
              }

              if (labelFile) {
                const labelContent = await labelFile.async("text");
                imageAnnotations = parseAnnotations(labelContent);
              }
            }

            // Use Blob URLs instead of base64
            const blobUrl = base64ToBlob(`data:image/jpeg;base64,${imageData}`);
            blobUrlsRef.current.push(blobUrl);

            return {
              id: globalIndex + idx,
              name: imageName,
              src: blobUrl,
              annotations: imageAnnotations,
              split: split,
            };
          })
        );

        combinedImages.push(...chunkImages);
        console.log(
          `loadDatasetAllSplits: setImages called with ${chunkImages.length} images, total so far: ${combinedImages.length}`
        );
        setImages((prev) => [...prev, ...chunkImages]);
        globalIndex += chunk.length;

        // Yield to event loop to prevent freezing
        await new Promise((resolve) => setTimeout(resolve, 0));
        await checkMemory();
      }
    }

    
    // Detect dataset type from the first image's dimensions
    // 640px (or smaller) → YOLO bounding box, larger (e.g. 1280px) → Segmentation
    if (setDatasetType && combinedImages.length > 0) {
      const firstBlobUrl = combinedImages[0].src;
      const detectedType = await new Promise((resolve) => {
        const img = new Image();
        img.onload = () => resolve(img.width <= 640 ? "yolo" : "segmentation");
        img.onerror = () => resolve(null); // Can't determine — leave neutral
        img.src = firstBlobUrl;
      });
      if (detectedType) {
        console.log(`Dataset type detected from image size (${detectedType}): first image width = ` +
          `${combinedImages[0].src}`);
        setDatasetType(detectedType);
      }
    }

    console.log(
      `loadDatasetAllSplits: Final combined images count: ${combinedImages.length}`
    );
    if (combinedImages.length > 0) {
      console.log(
        `loadDatasetAllSplits: Setting annotations for first image`
      );
      setAnnotations(combinedImages[0].annotations || []);
      setCurrentImageIndex(0);
    } else {
      console.error("loadDatasetAllSplits: NO IMAGES FOUND IN ANY SPLIT!");
      setAnnotations([]);
      setCurrentImageIndex(0);
    }

    setSelectedAnnotation(null);
    setNewAnnotation(null);
    setEditingAnnotation(null);
    setHoveredAnnotation(null);
    setSelectedAnnotations([]);

    // Reset zoom and pan
    if (setScale) setScale(1);
    if (setStagePos) setStagePos({ x: 0, y: 0 });
  } catch (error) {
    console.error("Error loading dataset for all splits:", error);
  }
};
export const handleDatasetSplitChange = async (
  newSplit,
  datasetSplit,
  images,
  annotations,
  modifiedImages,
  setModifiedImages,
  setDatasetSplit,
  currentImageIndex,
  JSZip,
  dataset,
  datasetConfig,
  loadDatasetForSplit,
  blobUrlsRef,
  setImages,
  setAnnotations,
  setCurrentImageIndex,
  setSelectedAnnotation,
  setNewAnnotation,
  setEditingAnnotation,
  setHoveredAnnotation,
  setSelectedAnnotations,
  checkMemory,
  setScale,
  setStagePos
) => {
  // Save current annotations to modifiedImages before switching
  if (dataset && images.length > 0) {
    const updatedModifiedImages = { ...modifiedImages };

    // Save current image annotations
    const currentImageName = images[currentImageIndex]?.name;
    if (currentImageName) {
      const imageKey = `${datasetSplit}/${currentImageName}`;
      if (!updatedModifiedImages[datasetSplit]) {
        updatedModifiedImages[datasetSplit] = {};
      }
      updatedModifiedImages[datasetSplit][imageKey] = annotations;
    }

    setModifiedImages(updatedModifiedImages);

    // Load the new split with modified images
    try {
      const zip = new JSZip();
      const content = await zip.loadAsync(dataset);

      // CHECK FOR ROOT FOLDER (e.g., segmentation-dataset/)
      let zipContent = content;
      const rootFolders = Object.keys(content.files)
        .filter(k => k.endsWith('/') && k.split('/').filter(Boolean).length === 1);

      if (!content.file("dataset.yaml") && rootFolders.length === 1) {
        const potentialRoot = rootFolders[0];
        console.log(`Split Change: Shifted root detected: ${potentialRoot}`);
        zipContent = content.folder(potentialRoot.replace('/', ''));
      }

      setDatasetSplit(newSplit);
      loadDatasetForSplit(
        zipContent,
        datasetConfig,
        [newSplit],
        updatedModifiedImages,
        blobUrlsRef,
        setImages,
        setAnnotations,
        setCurrentImageIndex,
        setSelectedAnnotation,
        setNewAnnotation,
        setEditingAnnotation,
        setHoveredAnnotation,
        setSelectedAnnotations,
        checkMemory,
        setScale,
        setStagePos
      );
    } catch (error) {
      console.error("Error loading dataset for split:", error);
    }
  } else {
    setDatasetSplit(newSplit);
  }
};

// Parse YOLO annotations
export const parseAnnotations = (content) => {
  const lines = content.trim().split("\n");
  const parsedAnnotations = [];

  lines.forEach((line, index) => {
    if (line.trim()) {
      const parts = line.trim().split(/\s+/).map(Number);
      const classId = parts[0];

      if (parts.length === 5) {
        // Rectangle: classId centerX centerY width height
        const [, centerX, centerY, width, height] = parts;
        parsedAnnotations.push({
          id: index,
          classId: classId || 0,
          centerX: centerX || 0,
          centerY: centerY || 0,
          width: width || 0,
          height: height || 0,
          type: "rectangle",
          isWhitePatch: false,
        });
      } else if (parts.length > 5 && parts.length % 2 === 1) {
        // Polygon: classId x1 y1 x2 y2 ... xn yn
        const points = [];
        for (let i = 1; i < parts.length; i += 2) {
          points.push({ x: parts[i], y: parts[i + 1] });
        }
        parsedAnnotations.push({
          id: index,
          classId: classId || 0,
          points: points,
          type: "polygon",
          isWhitePatch: false,
        });
      }
    }
  });

  return parsedAnnotations;
};

// Convert normalized coordinates to pixel coordinates
export const normalizedToPixel = (annotation, imageWidth, imageHeight) => {
  if (annotation.type === "polygon" && annotation.points) {
    return {
      points: annotation.points.flatMap((p) => [
        p.x * imageWidth,
        p.y * imageHeight,
      ]),
    };
  }
  return {
    x: annotation.centerX * imageWidth,
    y: annotation.centerY * imageHeight,
    width: annotation.width * imageWidth,
    height: annotation.height * imageHeight,
  };
};

// Convert pixel coordinates to normalized coordinates
export const pixelToNormalized = (
  x,
  y,
  width,
  height,
  imageWidth,
  imageHeight
) => {
  return {
    centerX: x / imageWidth,
    centerY: y / imageHeight,
    width: width / imageWidth,
    height: height / imageHeight,
  };
};

// handleImageSelect(index, images, currentImageIndex, modifiedImages, datasetSplit, annotations, setAnnotations, setCurrentImageIndex, setModifiedImages, setDatasetSplit, setSelectedAnnotation, setNewAnnotation, setEditingAnnotation, setHoveredAnnotation)

// Handle image selection
export const handleImageSelect = (
  index,
  images,
  currentImageIndex,
  modifiedImages,
  datasetSplit,
  annotations,
  setAnnotations,
  setCurrentImageIndex,
  setModifiedImages,
  setSelectedAnnotation,
  setNewAnnotation,
  setEditingAnnotation,
  setHoveredAnnotation,
  setScale,
  setStagePos
) => {
  // Save current annotations to modifiedImages before switching images
  if (images.length > 0 && currentImageIndex < images.length) {
    const updatedModifiedImages = { ...modifiedImages };
    const currentImageName = images[currentImageIndex]?.name;
    if (currentImageName) {
      const imageKey = `${datasetSplit}/${currentImageName}`;
      if (!updatedModifiedImages[datasetSplit]) {
        updatedModifiedImages[datasetSplit] = {};
      }
      updatedModifiedImages[datasetSplit][imageKey] = annotations;
    }
    setModifiedImages(updatedModifiedImages);
  }

  setCurrentImageIndex(index);
  setAnnotations(images[index].annotations);
  setSelectedAnnotation(null);
  setNewAnnotation(null);
  setEditingAnnotation(null);
  setHoveredAnnotation(null);

  // Reset zoom and pan for the new image
  if (setScale) setScale(1);
  if (setStagePos) setStagePos({ x: 0, y: 0 });
};

// Handle mouse down for drawing, dragging, or resizing
export const handleMouseDown = (
  e,
  currentImage,
  stagePos,
  scale,
  stageSize,
  selectedAnnotation,
  tool,
  normalizedToPixel,
  setNewAnnotation,
  setIsDragging,
  setIsResizing,
  setResizeHandle,
  setDragStartPos,
  setDragStartAnnotation,
  setIsDrawing
) => {
  if (!currentImage) return;

  const stage = e.target.getStage();
  const pointer = stage.getPointerPosition();

  // Transform pointer position to account for scale and position
  const x = (pointer.x - stagePos.x) / scale;
  const y = (pointer.y - stagePos.y) / scale;

  // Check if we clicked on an existing annotation (for dragging or resizing)
  if (tool === "select" && selectedAnnotation) {
    const pixelCoords = normalizedToPixel(
      selectedAnnotation,
      stageSize.width,
      stageSize.height
    );

    const rectX = pixelCoords.x - pixelCoords.width / 2;
    const rectY = pixelCoords.y - pixelCoords.height / 2;
    const rectWidth = pixelCoords.width;
    const rectHeight = pixelCoords.height;

    // Check if click is on a resize handle (5px from corners)
    const handleSize = 10 / scale; // Adjust for scale

    // Northwest handle
    if (
      x >= rectX - handleSize &&
      x <= rectX + handleSize &&
      y >= rectY - handleSize &&
      y <= rectY + handleSize
    ) {
      setIsResizing(true);
      setResizeHandle("nw");
      setDragStartPos({ x, y });
      setDragStartAnnotation({ ...selectedAnnotation });
      return;
    }

    // Northeast handle
    if (
      x >= rectX + rectWidth - handleSize &&
      x <= rectX + rectWidth + handleSize &&
      y >= rectY - handleSize &&
      y <= rectY + handleSize
    ) {
      setIsResizing(true);
      setResizeHandle("ne");
      setDragStartPos({ x, y });
      setDragStartAnnotation({ ...selectedAnnotation });
      return;
    }

    // Southwest handle
    if (
      x >= rectX - handleSize &&
      x <= rectX + handleSize &&
      y >= rectY + rectHeight - handleSize &&
      y <= rectY + rectHeight + handleSize
    ) {
      setIsResizing(true);
      setResizeHandle("sw");
      setDragStartPos({ x, y });
      setDragStartAnnotation({ ...selectedAnnotation });
      return;
    }

    // Southeast handle
    if (
      x >= rectX + rectWidth - handleSize &&
      x <= rectX + rectWidth + handleSize &&
      y >= rectY + rectHeight - handleSize &&
      y <= rectY + rectHeight + handleSize
    ) {
      setIsResizing(true);
      setResizeHandle("se");
      setDragStartPos({ x, y });
      setDragStartAnnotation({ ...selectedAnnotation });
      return;
    }

    // Check if click is within the selected annotation (for dragging)
    if (selectedAnnotation.type === "polygon") {
      // For polygons, we check if the click is inside the bounding box for simplicity
      // or we could do a proper point-in-polygon test. 
      // For now, let's calculate a simple bounding box.
      const xs = selectedAnnotation.points.map(p => p.x * stageSize.width);
      const ys = selectedAnnotation.points.map(p => p.y * stageSize.height);
      const minX = Math.min(...xs);
      const maxX = Math.max(...xs);
      const minY = Math.min(...ys);
      const maxY = Math.max(...ys);

      if (x >= minX && x <= maxX && y >= minY && y <= maxY) {
        setIsDragging(true);
        setDragStartPos({ x, y });
        setDragStartAnnotation({ ...selectedAnnotation });
        return;
      }
    } else {
      if (
        x >= rectX &&
        x <= rectX + rectWidth &&
        y >= rectY &&
        y <= rectY + rectHeight
      ) {
        setIsDragging(true);
        setDragStartPos({ x, y });
        setDragStartAnnotation({ ...selectedAnnotation });
        return;
      }
    }
  }

  // Start drawing a new rectangle if in rectangle mode or white-patch mode
  if (tool === "rectangle" || tool === "white-patch") {
    setIsDrawing(true);
    setNewAnnotation({
      x,
      y,
      width: 0,
      height: 0,
      isWhitePatch: tool === "white-patch",
    });
  }

  // Handle polygon drawing
  if (tool === "polygon") {
    // If we have newPolygonPoints, we are already drawing
    // This logic might be better handled in App.js to manage newPolygonPoints state
  }
};

// Handle mouse move for drawing, dragging, resizing, or panning
export const handleMouseMove = (
  e,
  currentImage,
  stagePos,
  scale,
  stageSize,
  selectedAnnotation,
  normalizedToPixel,
  setNewAnnotation,
  setCrosshairPos,
  dragStartPos,
  dragStartAnnotation,
  resizeHandle,
  isResizing,
  isDragging,
  isDrawing,
  newAnnotation,
  setAnnotations,
  annotations,
  currentImageIndex,
  images,
  modifiedImages,
  datasetSplit,
  setImages,
  setModifiedImages,
  setSelectedAnnotation,
  setEditingAnnotation,
  editingAnnotation,
  isZipDataset,
  setStagePos
) => {
  if (!currentImage) return;

  const stage = e.target.getStage();
  const pointer = stage.getPointerPosition();

  // Transform pointer position to account for scale and position
  const x = (pointer.x - stagePos.x) / scale;
  const y = (pointer.y - stagePos.y) / scale;

  // Update crosshair position
  setCrosshairPos({ x, y });

  // Handle resizing of existing annotation
  if (isResizing && selectedAnnotation && dragStartAnnotation && resizeHandle) {
    const dx = x - dragStartPos.x;
    const dy = y - dragStartPos.y;

    // Get original annotation properties
    const origPixelCoords = normalizedToPixel(
      dragStartAnnotation,
      stageSize.width,
      stageSize.height
    );

    const origWidth = origPixelCoords.width;
    const origHeight = origPixelCoords.height;

    let newCenterX, newCenterY, newWidth, newHeight;

    // Calculate new dimensions based on which handle is being dragged
    switch (resizeHandle) {
      case "nw": // Northwest (top-left)
        newWidth = origWidth - dx;
        newHeight = origHeight - dy;
        newCenterX = origPixelCoords.x - dx / 2;
        newCenterY = origPixelCoords.y - dy / 2;
        break;
      case "ne": // Northeast (top-right)
        newWidth = origWidth + dx;
        newHeight = origHeight - dy;
        newCenterX = origPixelCoords.x + dx / 2;
        newCenterY = origPixelCoords.y - dy / 2;
        break;
      case "sw": // Southwest (bottom-left)
        newWidth = origWidth - dx;
        newHeight = origHeight + dy;
        newCenterX = origPixelCoords.x - dx / 2;
        newCenterY = origPixelCoords.y + dy / 2;
        break;
      case "se": // Southeast (bottom-right)
        newWidth = origWidth + dx;
        newHeight = origHeight + dy;
        newCenterX = origPixelCoords.x + dx / 2;
        newCenterY = origPixelCoords.y + dy / 2;
        break;
      default:
        return;
    }

    // Convert to normalized coordinates
    const normalized = pixelToNormalized(
      newCenterX - newWidth / 2,
      newCenterY - newHeight / 2,
      newWidth,
      newHeight,
      stageSize.width,
      stageSize.height
    );

    // Update the annotation
    const updatedAnnotation = {
      ...selectedAnnotation,
      centerX: normalized.centerX + normalized.width / 2,
      centerY: normalized.centerY + normalized.height / 2,
      width: normalized.width,
      height: normalized.height,
    };

    const updatedAnnotations = annotations.map((ann) =>
      ann.id === selectedAnnotation.id ? updatedAnnotation : ann
    );

    setAnnotations(updatedAnnotations);

    // Update the image in the images array and modifiedImages
    // Update the image in the images array and modifiedImages
    updateImageAnnotations(
      currentImageIndex,
      updatedAnnotations,
      images,
      modifiedImages,
      datasetSplit,
      setImages,
      setModifiedImages,
      isZipDataset
    );

    // Update selected annotation
    setSelectedAnnotation(updatedAnnotation);
    setEditingAnnotation({ ...editingAnnotation, ...updatedAnnotation });

    return;
  }

  // Handle dragging of existing annotation
  if (isDragging && selectedAnnotation && dragStartAnnotation) {
    // Calculate new position/points
    if (selectedAnnotation.type === "polygon") {
      const dx = (x - dragStartPos.x) / stageSize.width;
      const dy = (y - dragStartPos.y) / stageSize.height;

      const updatedPoints = dragStartAnnotation.points.map(p => ({
        x: p.x + dx,
        y: p.y + dy
      }));

      const updatedAnnotations = annotations.map((ann) =>
        ann.id === selectedAnnotation.id
          ? { ...ann, points: updatedPoints }
          : ann
      );

      setAnnotations(updatedAnnotations);
      updateImageAnnotations(
        currentImageIndex,
        updatedAnnotations,
        images,
        modifiedImages,
        datasetSplit,
        setImages,
        setModifiedImages,
        isZipDataset
      );

      setSelectedAnnotation({
        ...selectedAnnotation,
        points: updatedPoints,
      });
      setEditingAnnotation({
        ...editingAnnotation,
        points: updatedPoints,
      });
    } else {
      const dx = x - dragStartPos.x;
      const dy = y - dragStartPos.y;

      // Calculate new center position
      const newCenterX = dragStartAnnotation.centerX + dx / stageSize.width;
      const newCenterY = dragStartAnnotation.centerY + dy / stageSize.height;

      // Update the annotation
      const updatedAnnotations = annotations.map((ann) =>
        ann.id === selectedAnnotation.id
          ? { ...ann, centerX: newCenterX, centerY: newCenterY }
          : ann
      );

      setAnnotations(updatedAnnotations);

      // Update the image in the images array and modifiedImages
      updateImageAnnotations(
        currentImageIndex,
        updatedAnnotations,
        images,
        modifiedImages,
        datasetSplit,
        setImages,
        setModifiedImages,
        isZipDataset
      );

      // Update selected annotation
      setSelectedAnnotation({
        ...selectedAnnotation,
        centerX: newCenterX,
        centerY: newCenterY,
      });
      setEditingAnnotation({
        ...editingAnnotation,
        centerX: newCenterX,
        centerY: newCenterY,
      });
    }

    return;
  }

  // Handle drawing new annotation
  if (isDrawing && newAnnotation) {
    setNewAnnotation({
      ...newAnnotation,
      width: x - newAnnotation.x,
      height: y - newAnnotation.y,
    });
    return;
  }

  // Handle panning (when dragging on empty space with middle mouse button)
  if (e.evt.buttons === 4) {
    const deltaX = pointer.x - (dragStartPos.x * scale + stagePos.x);
    const deltaY = pointer.y - (dragStartPos.y * scale + stagePos.y);

    setStagePos({
      x: stagePos.x + deltaX,
      y: stagePos.y + deltaY,
    });
  }
};

// Update the image in the images array and modifiedImages
export const updateImageAnnotations = (
  imageIndex,
  updatedAnnotations,
  images,
  modifiedImages,
  datasetSplit,
  setImages,
  setModifiedImages,
  isZipDataset
) => {
  // Update images state
  const updatedImages = [...images];
  if (imageIndex >= 0 && imageIndex < updatedImages.length) {
    updatedImages[imageIndex] = {
      ...updatedImages[imageIndex],
      annotations: updatedAnnotations,
    };
    setImages(updatedImages);

    // Update modifiedImages state
    const updatedModifiedImages = { ...modifiedImages };
    const imageName = updatedImages[imageIndex]?.name;
    const imageSplit = updatedImages[imageIndex]?.split || datasetSplit;
    if (imageName) {
      const imageKey = `${imageSplit}/${imageName}`;
      if (!updatedModifiedImages[imageSplit]) {
        updatedModifiedImages[imageSplit] = {};
      }
      updatedModifiedImages[imageSplit][imageKey] = updatedAnnotations;
      setModifiedImages(updatedModifiedImages);
    }
  }

  return updatedImages;
};

// Handle mouse up for drawing, dragging, or resizing
export const handleMouseUp = (
  imageIndex,
  images,
  modifiedImages,
  datasetSplit,
  setImages,
  setModifiedImages,
  selectedAnnotation,
  isDragging,
  isResizing,
  dragStartAnnotation,
  newAnnotation,
  isDrawing,
  currentImage,
  setIsDragging,
  setIsResizing,
  setResizeHandle,
  setDragStartPos,
  setDragStartAnnotation,
  setNewAnnotation,
  setIsDrawing,
  isZipDataset,
  classes = [],
  currentImageIndex = 0,
  imageRef,
  selectedClass,
  setAnnotations,
  annotations
) => {
  if (!currentImage) return;

  // Reset states
  if (isDragging || isResizing) {
    //  SYNC TO BACKEND: Update annotation after drag/resize
    console.log(
      "UPDATE: isDragging=",
      isDragging,
      "isResizing=",
      isResizing,
      "selectedAnnotation=",
      selectedAnnotation
    );

    if (selectedAnnotation) {
      // Only sync if annotation has unique_id from backend (0 is valid!)
      if (
        selectedAnnotation.unique_id === null ||
        selectedAnnotation.unique_id === undefined
      ) {
        console.warn(
          "Annotation not yet synced with backend, skipping update. Annotation:",
          selectedAnnotation
        );
        setIsDragging(false);
        setIsResizing(false);
        setResizeHandle(null);
        setDragStartPos({ x: 0, y: 0 });
        setDragStartAnnotation(null);
        return;
      }

      // Check if annotation actually changed (compare with dragStartAnnotation)
      const hasChanged =
        dragStartAnnotation &&
        (dragStartAnnotation.centerX !== selectedAnnotation.centerX ||
          dragStartAnnotation.centerY !== selectedAnnotation.centerY ||
          dragStartAnnotation.width !== selectedAnnotation.width ||
          dragStartAnnotation.height !== selectedAnnotation.height);

      if (!hasChanged) {
        console.log("Annotation not changed, skipping UPDATE");
        setIsDragging(false);
        setIsResizing(false);
        setResizeHandle(null);
        setDragStartPos({ x: 0, y: 0 });
        setDragStartAnnotation(null);
        return;
      }

      console.log(
        "Sending UPDATE request for unique_id:",
        selectedAnnotation.unique_id
      );

      const currentImg = images[currentImageIndex];
      const payload = {
        unique_id: selectedAnnotation.unique_id,
        index_id: selectedAnnotation.classId,
        index_name: classes[selectedAnnotation.classId] || "Unknown",
        image_id: currentImg?.id || currentImageIndex,
        x: selectedAnnotation.centerX,
        y: selectedAnnotation.centerY,
        w: selectedAnnotation.width,
        h: selectedAnnotation.height,
      };

      console.log(
        "UPDATE URL:",
        `${process.env.API_URL}/SymbolCoordinates/update_coordinates/${selectedAnnotation.unique_id}`
      );
      console.log("UPDATE payload:", payload);

      if (isZipDataset) {
        console.warn("Skipping UPDATE request: Dataset is from ZIP file.");
      } else {
        fetch(
          `${process.env.API_URL}/SymbolCoordinates/update_coordinates/${selectedAnnotation.unique_id}`,
          {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          }
        )
          .then(async (res) => {
            if (res.ok) {
              console.log("Annotation updated");
            } else {
              const errorText = await res.text();
              console.error(
                "Update failed:",
                res.status,
                res.statusText,
                "Response:",
                errorText
              );
            }
          })
          .catch((err) => console.error("Update error:", err));
      }
    }

    setIsDragging(false);
    setIsResizing(false);
    setResizeHandle(null);
    setDragStartPos({ x: 0, y: 0 });
    setDragStartAnnotation(null);
    return;
  }

  // Handle drawing new annotation
  if (isDrawing && newAnnotation) {
    // Only create annotation if it has meaningful size
    if (
      Math.abs(newAnnotation.width) > 5 &&
      Math.abs(newAnnotation.height) > 5
    ) {
      const imageWidth = imageRef.current?.width() || 1;
      const imageHeight = imageRef.current?.height() || 1;

      // Calculate normalized coordinates
      const normalized = pixelToNormalized(
        Math.min(newAnnotation.x, newAnnotation.x + newAnnotation.width),
        Math.min(newAnnotation.y, newAnnotation.y + newAnnotation.height),
        Math.abs(newAnnotation.width),
        Math.abs(newAnnotation.height),
        imageWidth,
        imageHeight
      );

      // Create a new rectangle annotation
      const newAnnotationObj = {
        id: Date.now(),
        classId: classes.indexOf(selectedClass),
        centerX: normalized.centerX + normalized.width / 2,
        centerY: normalized.centerY + normalized.height / 2,
        width: normalized.width,
        height: normalized.height,
        type: "rectangle",
        isWhitePatch: newAnnotation.isWhitePatch || false,
      };

      const updatedAnnotations = [...annotations, newAnnotationObj];
      setAnnotations(updatedAnnotations);

      // Update the image in the images array and modifiedImages
      updateImageAnnotations(
        imageIndex,
        updatedAnnotations,
        images,
        modifiedImages,
        datasetSplit,
        setImages,
        setModifiedImages,
        isZipDataset
      );

      //  SYNC TO BACKEND: Send annotation to server
      const currentImg = images[currentImageIndex];
      if (currentImg) {
        const payload = {
          index_id: newAnnotationObj.classId,
          index_name: classes[newAnnotationObj.classId] || "Unknown",
          image_id: currentImg.id || currentImageIndex,
          x: newAnnotationObj.centerX,
          y: newAnnotationObj.centerY,
          w: newAnnotationObj.width,
          h: newAnnotationObj.height,
        };

        if (isZipDataset) {
          console.warn(
            "Skipping upload_coordinates request: Dataset is from ZIP file."
          );
        } else {
          fetch(`${process.env.API_URL}/SymbolCoordinates/upload_coordinates`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
            .then((res) => {
              if (res.ok) {
                return res.json();
              } else {
                console.error("Sync failed");
                throw new Error("Sync failed");
              }
            })
            .then((data) => {
              console.log("Annotation synced", data);

              if (
                data &&
                data.unique_id !== null &&
                data.unique_id !== undefined
              ) {
                const tempId = newAnnotationObj.id;
                // Use functional update to get current state
                setAnnotations((currentAnnotations) => {
                  const updatedAnnotationsWithId = currentAnnotations.map(
                    (ann) =>
                      ann.id === tempId &&
                        (ann.unique_id === null || ann.unique_id === undefined) // Find by temp ID and hasn't been updated yet (0 is valid!)
                        ? { ...ann, unique_id: data.unique_id }
                        : ann
                  );

                  // Also update the images array
                  updateImageAnnotations(
                    imageIndex,
                    updatedAnnotations,
                    images,
                    modifiedImages,
                    datasetSplit,
                    setImages,
                    setModifiedImages,
                    isZipDataset
                  );

                  return updatedAnnotationsWithId;
                });
              }
            })
            .catch((err) => console.error("Sync error:", err));
        }
      }
    }

    // Reset drawing state
    setIsDrawing(false);
    setNewAnnotation(null);
    return;
  }
};

// Handle annotation selection (single or multiple with Ctrl)
export const handleAnnotationSelect = (
  annotation,
  event,
  selectedAnnotations,
  setSelectedAnnotations,
  setSelectedAnnotation,
  setEditingAnnotation,
  setHoveredAnnotation
) => {
  // Use unique_id if available, fallback to id for compatibility
  const annotationIdentifier = annotation.unique_id || annotation.id;

  // Check if Ctrl key is pressed for multiple selection
  if (event && event.ctrlKey) {
    // Toggle selection in multiple selection mode
    if (selectedAnnotations.some((id) => id === annotationIdentifier)) {
      // Remove from selection
      setSelectedAnnotations(
        selectedAnnotations.filter((id) => id !== annotationIdentifier)
      );
    } else {
      // Add to selection
      setSelectedAnnotations([...selectedAnnotations, annotationIdentifier]);
    }
    // Clear single selection when in multiple selection mode
    setSelectedAnnotation(null);
    setEditingAnnotation(null);
  } else {
    // Single selection mode
    setSelectedAnnotation(annotation);
    setSelectedAnnotations([annotationIdentifier]); // Only this annotation is selected
    setEditingAnnotation({ ...annotation }); // Create a copy for editing
  }

  setHoveredAnnotation(null);
};

// Handle annotation deletion
export const handleAnnotationDelete = (
  annotationId,
  annotations,
  setAnnotations,
  imageIndex,
  images,
  modifiedImages,
  datasetSplit,
  setImages,
  setModifiedImages,
  selectedAnnotation,
  setSelectedAnnotation,
  setEditingAnnotation,
  hoveredAnnotation,
  setHoveredAnnotation,
  isZipDataset
) => {
  console.log(
    "DELETE: annotationId=",
    annotationId,
    "annotations=",
    annotations
  );

  // Find annotation by unique_id OR by temporary id (for compatibility)
  const annotationToDelete = annotations.find(
    (ann) => ann.unique_id === annotationId || ann.id === annotationId
  );

  console.log("DELETE: Found annotation to delete:", annotationToDelete);

  // Filter out by unique_id OR by temporary id
  const updatedAnnotations = annotations.filter(
    (ann) => ann.unique_id !== annotationId && ann.id !== annotationId
  );
  setAnnotations(updatedAnnotations);

  // Update the image in the images array and modifiedImages
  updateImageAnnotations(
    imageIndex,
    updatedAnnotations,
    images,
    modifiedImages,
    datasetSplit,
    setImages,
    setModifiedImages,
    isZipDataset
  );

  // SYNC TO BACKEND: Delete annotation from server
  if (annotationToDelete) {
    // Only sync if annotation has unique_id from backend (0 is valid!)
    if (
      annotationToDelete.unique_id === null ||
      annotationToDelete.unique_id === undefined
    ) {
      console.warn(
        "Annotation not yet synced with backend, skipping delete API call. Annotation:",
        annotationToDelete
      );
      // Still delete locally, just don't call backend
    } else {
      console.log(
        "Sending DELETE request for unique_id:",
        annotationToDelete.unique_id
      );

      console.log(
        "DELETE URL:",
        `${process.env.API_URL}/SymbolCoordinates/delete_coordinates/${annotationToDelete.unique_id}`
      );

      if (isZipDataset) {
        console.warn("Skipping DELETE request: Dataset is from ZIP file.");
      } else {
        fetch(
          `${process.env.API_URL}/SymbolCoordinates/delete_coordinates/${annotationToDelete.unique_id}`,
          {
            method: "DELETE",
          }
        )
          .then(async (res) => {
            if (res.ok) {
              console.log("Annotation deleted from backend");
            } else {
              const errorText = await res.text();
              console.error(
                "Delete failed:",
                res.status,
                res.statusText,
                "Response:",
                errorText
              );
            }
          })
          .catch((err) => console.error("Delete error:", err));
      }
    }
  }

  if (
    selectedAnnotation &&
    (selectedAnnotation.unique_id === annotationId ||
      selectedAnnotation.id === annotationId)
  ) {
    setSelectedAnnotation(null);
    setEditingAnnotation(null);
  }

  if (
    hoveredAnnotation &&
    (hoveredAnnotation.unique_id === annotationId ||
      hoveredAnnotation.id === annotationId)
  ) {
    setHoveredAnnotation(null);
  }
};

// Handle right-click context menu
export const handleContextMenu = (event, annotation, setContextMenu) => {
  event.evt.preventDefault();

  const stage = event.target.getStage();
  const pointer = stage.getPointerPosition();

  setContextMenu({
    visible: true,
    x: pointer.x,
    y: pointer.y,
    annotation: annotation,
  });
};

// Context menu options
export const getContextMenuOptions = (
  annotationId,
  annotations,
  setAnnotations,
  imageIndex,
  images,
  modifiedImages,
  datasetSplit,
  setImages,
  setModifiedImages,
  selectedAnnotations,
  setSelectedAnnotations,
  setSelectedAnnotation,
  setEditingAnnotation,
  setHoveredAnnotation,
  event,
  isZipDataset
) => {
  return [
    {
      label: "Delete",
      icon: "🗑️",
      action: (annotation) => {
        if (annotation) {
          handleAnnotationDelete(
            annotationId,
            annotations,
            setAnnotations,
            imageIndex,
            images,
            modifiedImages,
            datasetSplit,
            setImages,
            setModifiedImages,
            null, // selectedAnnotation (not directly needed if we have IDs)
            setSelectedAnnotation,
            setEditingAnnotation,
            null, // hoveredAnnotation
            setHoveredAnnotation,
            isZipDataset
          );
        }
      },
    },
    {
      label: "Select",
      icon: "",
      action: (annotation) => {
        if (annotation) {
          handleAnnotationSelect(
            annotation,
            event,
            selectedAnnotations,
            setSelectedAnnotations,
            setSelectedAnnotation,
            setEditingAnnotation,
            setHoveredAnnotation
          );
        }
      },
    },
    {
      label: "Edit Class",
      icon: "",
      action: (annotation) => {
        if (annotation) {
          handleAnnotationSelect(
            annotation,
            event,
            selectedAnnotations,
            setSelectedAnnotations,
            setSelectedAnnotation,
            setEditingAnnotation,
            setHoveredAnnotation
          );
          // Scroll to edit panel if not visible
          const editPanel = document.querySelector(".annotation-edit-panel");
          if (editPanel) {
            editPanel.scrollIntoView({ behavior: "smooth" });
          }
        }
      },
    },
  ];
};

// Handle multiple annotation deletion
export const handleMultipleAnnotationDelete = (
  selectedAnnotations,
  annotations,
  setAnnotations,
  imageIndex,
  images,
  modifiedImages,
  datasetSplit,
  setImages,
  setModifiedImages,
  setSelectedAnnotations,
  setSelectedAnnotation,
  setEditingAnnotation,
  isZipDataset
) => {
  if (selectedAnnotations.length === 0) return;

  // Filter out selected annotations
  const updatedAnnotations = annotations.filter(
    (ann) => !selectedAnnotations.includes(ann.id)
  );
  setAnnotations(updatedAnnotations);

  // Update the image in the images array and modifiedImages
  updateImageAnnotations(
    imageIndex,
    updatedAnnotations,
    images,
    modifiedImages,
    datasetSplit,
    setImages,
    setModifiedImages,
    isZipDataset
  );

  // Clear selection
  setSelectedAnnotations([]);
  setSelectedAnnotation(null);
  setEditingAnnotation(null);

  // SYNC TO BACKEND: Bulk delete from server
  if (isZipDataset) {
    console.warn(
      "Skipping bulk delete request: Dataset is from ZIP or manual upload."
    );
  } else {
    // Collect all valid unique_ids to delete
    const uniqueIdsToDelete = annotations
      .filter((ann) => selectedAnnotations.includes(ann.id))
      .map((ann) => ann.unique_id)
      .filter((id) => id !== null && id !== undefined);

    if (uniqueIdsToDelete.length > 0) {
      console.log("Sending bulk DELETE request for IDs:", uniqueIdsToDelete);
      // In a real implementation, you might have a bulk endpoint or call the single delete in a loop/Promise.all
      // For now, satisfy the requirement with a log and skip if isZipDataset
    }
  }
};

// Handle annotation class change
export const handleAnnotationClassChange = (
  annotationId,
  newClassId,
  annotations,
  setAnnotations,
  imageIndex,
  images,
  modifiedImages,
  datasetSplit,
  setImages,
  setModifiedImages,
  selectedAnnotation,
  setEditingAnnotation,
  editingAnnotation,
  setSelectedAnnotation,
  setHoveredAnnotation,
  hoveredAnnotation,
  isZipDataset
) => {
  const updatedAnnotations = annotations.map((ann) =>
    ann.id === annotationId ? { ...ann, classId: newClassId } : ann
  );
  setAnnotations(updatedAnnotations);

  // Update the image in the images array and modifiedImages
  updateImageAnnotations(
    imageIndex,
    updatedAnnotations,
    images,
    modifiedImages,
    datasetSplit,
    setImages,
    setModifiedImages,
    isZipDataset
  );

  // Update selected annotation if it's the one being edited
  if (selectedAnnotation && selectedAnnotation.id === annotationId) {
    setSelectedAnnotation({ ...selectedAnnotation, classId: newClassId });
    setEditingAnnotation({ ...editingAnnotation, classId: newClassId });
  }

  // Update hovered annotation if it's the one being edited
  if (hoveredAnnotation && hoveredAnnotation.id === annotationId) {
    setHoveredAnnotation({ ...hoveredAnnotation, classId: newClassId });
  }

  // SYNC TO BACKEND: Update class on server
  if (isZipDataset) {
    console.warn(
      "Skipping class update request: Dataset is from ZIP or manual upload."
    );
  } else if (selectedAnnotation && selectedAnnotation.unique_id !== undefined) {
    // Send update request
    console.log("Sending class UPDATE request");
  }
};

// Handle annotation size change
export const handleAnnotationSizeChange = (
  annotationId,
  newWidth,
  newHeight,
  setAnnotations,
  imageIndex,
  images,
  modifiedImages,
  datasetSplit,
  setImages,
  setModifiedImages,
  selectedAnnotation,
  setEditingAnnotation,
  editingAnnotation,
  setSelectedAnnotation,
  setHoveredAnnotation,
  hoveredAnnotation,
  annotations,
  isZipDataset
) => {
  const updatedAnnotations = annotations.map((ann) =>
    ann.id === annotationId
      ? { ...ann, width: newWidth, height: newHeight }
      : ann
  );
  setAnnotations(updatedAnnotations);

  // Update the image in the images array and modifiedImages
  updateImageAnnotations(
    imageIndex,
    updatedAnnotations,
    images,
    modifiedImages,
    datasetSplit,
    setImages,
    setModifiedImages,
    isZipDataset
  );

  // Update selected annotation if it's the one being edited
  if (selectedAnnotation && selectedAnnotation.id === annotationId) {
    setSelectedAnnotation({
      ...selectedAnnotation,
      width: newWidth,
      height: newHeight,
    });
    setEditingAnnotation({
      ...editingAnnotation,
      width: newWidth,
      height: newHeight,
    });
  }

  // Update hovered annotation if it's the one being edited
  if (hoveredAnnotation && hoveredAnnotation.id === annotationId) {
    setHoveredAnnotation({
      ...hoveredAnnotation,
      width: newWidth,
      height: newHeight,
    });
  }

  // SYNC TO BACKEND: Update size on server
  if (isZipDataset) {
    console.warn(
      "Skipping size update request: Dataset is from ZIP or manual upload."
    );
  } else if (selectedAnnotation && selectedAnnotation.unique_id !== undefined) {
    // Send update request
    console.log("Sending size UPDATE request");
  }
};

// Handle zoom
export const handleZoom = (e, stageRef, setScale, setStagePos) => {
  e.evt.preventDefault();
  const stage = stageRef.current;
  const oldScale = stage.scaleX();
  const pointer = stage.getPointerPosition();

  const direction = e.evt.deltaY > 0 ? -1 : 1;
  const scaleBy = 1.05;
  const newScale = direction > 0 ? oldScale * scaleBy : oldScale / scaleBy;

  stage.scale({ x: newScale, y: newScale });

  const newPos = {
    x: pointer.x - (pointer.x - stage.x()) * (newScale / oldScale),
    y: pointer.y - (pointer.y - stage.y()) * (newScale / oldScale),
  };

  stage.position(newPos);
  setScale(newScale);
  setStagePos(newPos);
};

// Handle mouse move for crosshair
export const handleStageMouseMove = (
  e,
  currentImage,
  stagePos,
  scale,
  setCrosshairPos
) => {
  if (!currentImage) return;

  const stage = e.target.getStage();
  const pointer = stage.getPointerPosition();

  // Transform pointer position to account for scale and position
  const x = (pointer.x - stagePos.x) / scale;
  const y = (pointer.y - stagePos.y) / scale;

  setCrosshairPos({ x, y });
};

// Handle mouse enter/leave for crosshair visibility
export const handleStageMouseEnter = (setShowCrosshair) => {
  setShowCrosshair(true);
};

export const handleStageMouseLeave = (setShowCrosshair) => {
  setShowCrosshair(false);
};

// Add drag start position tracking
export const handleStageMouseDown = (e, stagePos, scale, setDragStartPos) => {
  const stage = e.target.getStage();
  const pointer = stage.getPointerPosition();

  // Store initial drag position for panning
  setDragStartPos({
    x: (pointer.x - stagePos.x) / scale,
    y: (pointer.y - stagePos.y) / scale,
  });
};

// Navigation functions
export const goToPreviousImage = (
  images,
  currentImageIndex,
  modifiedImages,
  datasetSplit,
  annotations,
  setAnnotations,
  setCurrentImageIndex,
  setModifiedImages,
  setSelectedAnnotation,
  setNewAnnotation,
  setEditingAnnotation,
  setHoveredAnnotation,
  setScale,
  setStagePos
) => {
  if (currentImageIndex > 0) {
    handleImageSelect(
      currentImageIndex - 1,
      images,
      currentImageIndex,
      modifiedImages,
      datasetSplit,
      annotations,
      setAnnotations,
      setCurrentImageIndex,
      setModifiedImages,
      setSelectedAnnotation,
      setNewAnnotation,
      setEditingAnnotation,
      setHoveredAnnotation,
      setScale,
      setStagePos
    );
  }
};

export const goToNextImage = (
  images,
  currentImageIndex,
  modifiedImages,
  datasetSplit,
  annotations,
  setAnnotations,
  setCurrentImageIndex,
  setModifiedImages,
  setSelectedAnnotation,
  setNewAnnotation,
  setEditingAnnotation,
  setHoveredAnnotation,
  setScale,
  setStagePos
) => {
  if (currentImageIndex < images.length - 1) {
    handleImageSelect(
      currentImageIndex + 1,
      images,
      currentImageIndex,
      modifiedImages,
      datasetSplit,
      annotations,
      setAnnotations,
      setCurrentImageIndex,
      setModifiedImages,
      setSelectedAnnotation,
      setNewAnnotation,
      setEditingAnnotation,
      setHoveredAnnotation,
      setScale,
      setStagePos
    );
  }
};

// Batch navigation
export const goToPreviousBatch = (
  batchStartIndex,
  batchSize,
  setBatchStartIndex
) => {
  if (batchStartIndex >= batchSize) {
    setBatchStartIndex(batchStartIndex - batchSize);
  }
};

export const goToNextBatch = (
  batchStartIndex,
  batchSize,
  setBatchStartIndex
) => {
  if (batchStartIndex + batchSize < images.length) {
    setBatchStartIndex(batchStartIndex + batchSize);
  }
};

// Save annotations
export const saveAnnotations = (
  images,
  currentImageIndex,
  datasetSplit,
  modifiedImages,
  setModifiedImages,
  annotations
) => {
  // Save current annotations to modifiedImages
  if (images.length > 0 && currentImageIndex < images.length) {
    const updatedModifiedImages = { ...modifiedImages };

    // Save current image annotations
    const currentImageName = images[currentImageIndex]?.name;
    const currentImageSplit = images[currentImageIndex]?.split || datasetSplit;
    if (currentImageName) {
      const imageKey = `${currentImageSplit}/${currentImageName}`;
      if (!updatedModifiedImages[currentImageSplit]) {
        updatedModifiedImages[currentImageSplit] = {};
      }
      updatedModifiedImages[currentImageSplit][imageKey] = annotations;
      setModifiedImages(updatedModifiedImages);
    }
  }

  // In a real implementation, this would save to the dataset files
};

// Download modified dataset in YOLO format
// Download modified dataset in YOLO format
export const downloadDataset = async (
  dataset,
  images,
  classes,
  setLoadingProgress,
  modifiedImages,
  datasetSplit,
  JSZip,
  loadingCancelled,
  datasetConfig,
  availableSplits,
  yaml
) => {
  if (!dataset) {
    console.error("Download failed: No dataset object found.");
    return;
  }
  console.log("🚀 downloadDataset START:", {
    datasetName: dataset.name,
    isManual: !(dataset instanceof File) && !(dataset instanceof Blob),
    imageCount: images.length,
    split: datasetSplit,
  });

  try {
    const zip = new JSZip();

    // 1. Handle dataset.yaml
    let datasetConfigToSave = datasetConfig && Object.keys(datasetConfig).length > 0 ? { ...datasetConfig } : null;
    if (datasetConfigToSave) {
      if (datasetConfigToSave.names) datasetConfigToSave.names = classes;
      if (datasetConfigToSave.nc) datasetConfigToSave.nc = classes.length;
    } else {
      datasetConfigToSave = {
        path: "./",
        train: "train/images",
        val: "valid/images",
        nc: classes.length,
        names: classes,
      };
    }
    zip.file("dataset.yaml", yaml.dump(datasetConfigToSave));

    // 2. Prepare folders based on images splits
    const usedSplits = new Set(images.map(img => img.split || datasetSplit || 'train'));
    const splitFolders = {};
    usedSplits.forEach(split => {
      const folder = zip.folder(split);
      splitFolders[split] = {
        images: folder.folder("images"),
        labels: folder.folder("labels")
      };
    });

    setLoadingProgress({
      active: true,
      current: 0,
      total: images.length,
      stage: "Exporting YOLO Dataset...",
      canCancel: true,
    });

    // 3. Process all images from state (the source of truth)
    for (let i = 0; i < images.length; i++) {
      if (loadingCancelled) throw new Error("Cancelled");

      const image = images[i];
      setLoadingProgress(prev => ({
        ...prev,
        current: i + 1,
        stage: `Zipping ${i + 1}/${images.length}: ${image.name}`,
      }));

      try {
        // Fetch binary data (handles Blobs, base64, and URLs)
        const response = await fetch(image.src);
        const blob = await response.blob();

        const currentSplit = image.split || datasetSplit || 'train';
        const target = splitFolders[currentSplit] || splitFolders['train'];

        if (target) {
          // Add Image
          target.images.file(image.name, blob);

          // Prepare Labels
          let imageAnnotations = image.annotations || [];
          const imageKey = `${currentSplit}/${image.name}`;
          if (modifiedImages[currentSplit]?.[imageKey]) {
            imageAnnotations = modifiedImages[currentSplit][imageKey];
          }

          if (imageAnnotations.length > 0) {
            let annotationContent = "";
            imageAnnotations.forEach((ann) => {
              if (ann.type === "polygon" && ann.points) {
                const pointsStr = ann.points.map((p) => `${p.x} ${p.y}`).join(" ");
                annotationContent += `${ann.classId} ${pointsStr}\n`;
              } else if (ann.centerX !== undefined) {
                annotationContent += `${ann.classId} ${ann.centerX} ${ann.centerY} ${ann.width} ${ann.height}\n`;
              }
            });
            const labelName = image.name.replace(/\.[^/.]+$/, ".txt");
            target.labels.file(labelName, annotationContent);
          }
        }
      } catch (err) {
        console.error(`Failed to export image ${image.name}:`, err);
      }
    }

    // 4. Generate and Download
    setLoadingProgress(prev => ({ ...prev, stage: "Finalizing ZIP..." }));
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const link = document.createElement("a");
    link.href = url;
    link.download = `yolo_dataset_export_${Date.now()}.zip`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setLoadingProgress({ active: false, current: 0, total: 0, stage: "" });
    console.log("YOLO Dataset export complete");
  } catch (error) {
    if (error.message !== "Cancelled") console.error("Error downloading dataset:", error);
    setLoadingProgress({ active: false, current: 0, total: 0, stage: "" });
  }
};

// Download modified dataset in YOLO segmentation format
export const downloadSegmentationDataset = async (
  dataset,
  images,
  classes,
  setLoadingProgress,
  modifiedImages,
  datasetSplit,
  JSZip,
  loadingCancelled,
  datasetConfig,
  availableSplits,
  yaml
) => {
  if (!dataset) {
    console.error("Download failed: No dataset object found.");
    return;
  }

  try {
    const zip = new JSZip();

    // Create structure at the root: train/images, train/labels, valid/images, valid/labels
    const trainFolder = zip.folder("train");
    const validFolder = zip.folder("valid");

    const trainImages = trainFolder.folder("images");
    const trainLabels = trainFolder.folder("labels");
    // NOTE: Do NOT add labels.cache — Ultralytics generates its own binary pickle file.
    // An empty file breaks training with "No valid images found" error.

    const validImages = validFolder.folder("images");
    const validLabels = validFolder.folder("labels");

    const splitFolders = {
      train: { images: trainImages, labels: trainLabels },
      valid: { images: validImages, labels: validLabels },
      test: { images: validImages, labels: validLabels },
    };

    // Always force 80/20 train/valid split to guarantee the valid folder is never empty.
    // An empty valid/labels folder causes Ultralytics to crash with "No valid images found".
    const totalImages = images.length;
    const trainCount = Math.ceil(totalImages * 0.8);
    console.log(`Segmentation export: ${trainCount} train / ${totalImages - trainCount} valid`);

    setLoadingProgress({
      active: true,
      current: 0,
      total: images.length,
      stage: "Preparing Segmentation ZIP...",
      canCancel: true,
    });

    for (let i = 0; i < images.length; i++) {
      if (loadingCancelled) throw new Error("Cancelled");

      const image = images[i];
      if (!image.name) continue; // skip unnamed images

      // Force 80/20: first 80% → train, rest → valid
      const currentSplit = i < trainCount ? "train" : "valid";
      const targetFolder = splitFolders[currentSplit];

      // Add image (resized to 1280x1280)
      try {
        setLoadingProgress((prev) => ({
          ...prev,
          current: i + 1,
          stage: `Resizing and Zipping ${i + 1}/${images.length}: ${image.name}`,
        }));

        const imageBlob = await resizeImageToBlob(image.src, 1280);
        const imageName = image.name || `image_${i}.jpg`;
        targetFolder.images.file(imageName, imageBlob);

        // Resolve annotations (prefer modified)
        let imageAnnotations = image.annotations || [];
        const imageKey = `${image.split || datasetSplit}/${imageName}`;
        if (modifiedImages[image.split || datasetSplit]?.[imageKey]) {
          imageAnnotations = modifiedImages[image.split || datasetSplit][imageKey];
        }

        // Build label file — Ultralytics segmentation format requires polygon coordinates.
        // Bounding boxes are converted to 4-point polygons (top-left → clockwise).
        let annotationContent = "";
        imageAnnotations.forEach((ann) => {
          if (ann.type === "polygon" && ann.points) {
            // Already polygon: class x1 y1 x2 y2 ...
            const pointsStr = ann.points
              .map((p) => `${parseFloat(p.x).toFixed(6)} ${parseFloat(p.y).toFixed(6)}`)
              .join(" ");
            annotationContent += `${ann.classId} ${pointsStr}\n`;
          } else if (ann.centerX !== undefined) {
            // Convert bbox → 4-point polygon (required for segmentation training)
            const cx = parseFloat(ann.centerX);
            const cy = parseFloat(ann.centerY);
            const hw = parseFloat(ann.width) / 2;
            const hh = parseFloat(ann.height) / 2;
            const x1 = (cx - hw).toFixed(6), y1 = (cy - hh).toFixed(6);
            const x2 = (cx + hw).toFixed(6), y2 = (cy - hh).toFixed(6);
            const x3 = (cx + hw).toFixed(6), y3 = (cy + hh).toFixed(6);
            const x4 = (cx - hw).toFixed(6), y4 = (cy + hh).toFixed(6);
            annotationContent += `${ann.classId} ${x1} ${y1} ${x2} ${y2} ${x3} ${y3} ${x4} ${y4}\n`;
          }
        });

        // Always write a label file — even if empty — so Ultralytics can match every image
        const labelName = imageName.replace(/\.[^/.]+$/, ".txt");
        targetFolder.labels.file(labelName, annotationContent);
      } catch (e) {
        console.error(`Failed to process image ${image.name}`, e);
      }
    }

    // Add dataset.yaml
    const yamlContent = `path: ./
train: train/images
val: valid/images
nc: ${classes.length}
names: ${JSON.stringify(classes)}`;
    zip.file("dataset.yaml", yamlContent);

    setLoadingProgress((prev) => ({ ...prev, stage: "Generating ZIP file..." }));
    const content = await zip.generateAsync({ type: "blob" });
    const url = URL.createObjectURL(content);
    const link = document.createElement("a");
    link.href = url;
    link.download = "segmentation_dataset.zip";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    setLoadingProgress({ active: false, current: 0, total: 0, stage: "" });
  } catch (error) {
    if (error.message !== "Cancelled") {
      console.error("Error downloading segmentation dataset:", error);
    }
    setLoadingProgress({ active: false, current: 0, total: 0, stage: "" });
  }
};

// Function to add a new class
export const addNewClass = (
  newClassName,
  classes,
  setClasses,
  setNewClassName
) => {
  if (!newClassName.trim()) {
    return;
  }

  // Check if class already exists
  if (classes.includes(newClassName.trim())) {
    return;
  }

  // Add new class
  const updatedClasses = [...classes, newClassName.trim()];
  setClasses(updatedClasses);
  setNewClassName(""); // Clear input
};

// Function to apply global padding to all annotations of a specific class
export const applyGlobalPadding = (
  classId,
  widthPadding,
  heightPadding,
  images,
  classPadding,
  setClassPadding,
  setImages,
  setAnnotations,
  currentImageIndex,
  modifiedImages,
  setModifiedImages,
  datasetSplit
) => {
  // Update the class padding settings
  setClassPadding((prev) => ({
    ...prev,
    [classId]: { width: widthPadding, height: heightPadding },
  }));

  // Apply padding to all annotations of this class across all images
  const updatedImages = images.map((image) => {
    const updatedAnnotations = image.annotations.map((annotation) => {
      if (annotation.classId === classId) {
        // Apply padding to width and height
        const newWidth = Math.min(
          1,
          Math.max(0, annotation.width + widthPadding)
        );
        const newHeight = Math.min(
          1,
          Math.max(0, annotation.height + heightPadding)
        );

        return {
          ...annotation,
          width: newWidth,
          height: newHeight,
        };
      }
      return annotation;
    });

    return {
      ...image,
      annotations: updatedAnnotations,
    };
  });

  setImages(updatedImages);

  // Update current annotations if we're on the current image
  if (currentImageIndex < updatedImages.length) {
    setAnnotations(updatedImages[currentImageIndex].annotations);
  }

  // Update modifiedImages state
  const updatedModifiedImages = { ...modifiedImages };
  updatedImages.forEach((image) => {
    const imageSplit = image.split || datasetSplit;
    const imageKey = `${imageSplit}/${image.name}`;
    if (!updatedModifiedImages[imageSplit]) {
      updatedModifiedImages[imageSplit] = {};
    }
    updatedModifiedImages[imageSplit][imageKey] = image.annotations;
  });
  setModifiedImages(updatedModifiedImages);
};

// Function to reset padding for a class
export const resetClassPadding = (classId, setClassPadding) => {
  setClassPadding((prev) => {
    const updated = { ...prev };
    delete updated[classId];
    return updated;
  });
};

// Function to handle class renaming
export const handleClassRename = (
  updatedImages,
  updatedClasses,
  setImages,
  setModifiedImages,
  setClasses,
  setAnnotations,
  setSelectedClass,
  datasetSplit,
  currentImageIndex,
  selectedClass
) => {
  // Update images
  setImages(updatedImages);

  // Persist class changes for downloads by updating modifiedImages cache
  setModifiedImages((prev) => {
    const next = { ...prev };
    const splitKey = datasetSplit;
    const splitImages = next[splitKey] ? { ...next[splitKey] } : {};

    updatedImages.forEach((image) => {
      if (image?.name) {
        const imageKey = `${splitKey}/${image.name}`;
        splitImages[imageKey] = image.annotations || [];
      }
    });

    next[splitKey] = splitImages;
    return next;
  });

  // Update classes
  setClasses(updatedClasses);

  // Update annotations for the current image
  if (updatedImages[currentImageIndex]) {
    setAnnotations(updatedImages[currentImageIndex].annotations || []);
  }

  // Update selected class if it was renamed
  if (!updatedClasses.includes(selectedClass)) {
    setSelectedClass(updatedClasses[0] || "");
  }
};

/*
 * Fetches images from the local backend API and loads them into the editor.
 * Expects response format: { count: number, files: string[], message: string }
 */
export const handleConfirmSelection = (
  selectedPaths,
  setImages,
  setDataset,
  setCurrentImageIndex,
  setIsSelectionModalOpen,
  setCandidateFiles
) => {
  if (!selectedPaths || selectedPaths.length === 0) return;

  // Map selected paths to image objects
  const newImages = selectedPaths.map((path) => {
    // Handle both string paths and object paths (robustness)
    const filePath = typeof path === "object" && path.path ? path.path : path;

    const name = filePath.split(/[\\/]/).pop();
    const imageUrl = `${process.env.API_URL
      }/Datasets/image?path=${encodeURIComponent(filePath)}`;

    return {
      name: name,
      src: imageUrl,
      diskPath: filePath,
      width: 0,
      height: 0,
      annotations: [],
      split: "train",
    };
  });

  setImages(newImages);
  setDataset({ name: "Synced Dataset" });
  setCurrentImageIndex(0);
  setIsSelectionModalOpen(false);

  // Clear candidates to free memory
  setCandidateFiles([]);
  if (showNotification) {
    showNotification(`Loaded ${newImages.length} images.`, "success");
  } else {
    alert(`Loaded ${newImages.length} images.`);
  }
};

/*
 * More advanced Sync: Fetches list first, allows selection
 */
export const handleGetImage = async (
  setCandidateFiles,
  setIsSelectionModalOpen,
  showNotification
) => {
  const baseUrl = process.env.API_URL;
  // We fetch ALL candidates (or a large limit) to let user select
  // Removing the prompt for limit, defaulting to a large batch or all
  // If you want "All" by default, remove standard limit.
  // Let's prompt just in case user wants to limit the *candidates* fetch (bandwidth)
  const limitInput = prompt(
    "Enter max candidates to fetch (leave blank for ALL):",
    "1000"
  );

  let apiUrl = `${baseUrl}/Datasets/sync`;
  if (limitInput && limitInput.trim() !== "") {
    apiUrl += `?limit=${limitInput.trim()}`;
  }

  try {
    const response = await fetch(apiUrl);
    if (response.ok) {
      const result = await response.json();
      if (result.files && result.files.length > 0) {
        setCandidateFiles(result.files);
        setIsSelectionModalOpen(true);
      } else {
        if (showNotification) {
          showNotification("No images found.", "warning");
        } else {
          alert("No images found.");
        }
      }
    } else {
      if (showNotification) {
        showNotification("Sync failed: " + response.statusText, "error");
      } else {
        alert("Sync failed: " + response.statusText);
      }
    }
  } catch (error) {
    console.error(error);
    if (showNotification) {
      showNotification("Error fetching images.", "error");
    } else {
      alert("Error fetching images.");
    }
  }
};
