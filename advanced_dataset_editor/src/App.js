import React, { useState, useRef, useEffect } from 'react';
import { Stage, Layer, Rect, Circle, Line, Text, Image as KonvaImage } from 'react-konva';
import { useDropzone } from 'react-dropzone';
import JSZip from 'jszip';
import yaml from 'js-yaml';
import Dashboard from './components/Dashboard/Dashboard';
import MergeDatasets from './components/MergeDatasets/MergeDatasets';
import DatasetMonitor from './components/DatasetMonitor/DatasetMonitor';
import ContextMenu from './components/ContextMenu/ContextMenu';

// import TestingSection from './TestingSection';
import './styles/styles.css';




const App = () => {
  // State management
  const [dataset, setDataset] = useState(null);
  const [datasetConfig, setDatasetConfig] = useState(null); // Store original dataset config
  const [images, setImages] = useState([]);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [annotations, setAnnotations] = useState([]);
  const [selectedAnnotation, setSelectedAnnotation] = useState(null);
  const [classes, setClasses] = useState(['duplex_receptacle']);
  const [selectedClass, setSelectedClass] = useState('duplex_receptacle');
  const [tool, setTool] = useState('select'); // select, rectangle, polygon
  const [isDrawing, setIsDrawing] = useState(false);
  const [stageSize, setStageSize] = useState({ width: 800, height: 600 });
  const [scale, setScale] = useState(1);
  const [stagePos, setStagePos] = useState({ x: 0, y: 0 });
  const [newAnnotation, setNewAnnotation] = useState(null); // For interactive drawing
  const [batchStartIndex, setBatchStartIndex] = useState(0); // For batch navigation
  const [batchSize] = useState(50); // Show 50 images per batch
  const [editingAnnotation, setEditingAnnotation] = useState(null); // For annotation editing
  const [hoveredAnnotation, setHoveredAnnotation] = useState(null); // For hover tooltip
  const [crosshairPos, setCrosshairPos] = useState({ x: 0, y: 0 });
  const [showCrosshair, setShowCrosshair] = useState(false);
  const [currentView, setCurrentView] = useState('editor'); // 'editor', 'dashboard', 'merge', 'monitor', or 'testing'

  // State for global padding settings
  const [classPadding, setClassPadding] = useState({}); // { classId: { width: 0.1, height: 0.1 } }

  // Store modified images for each split to preserve changes
  const [modifiedImages, setModifiedImages] = useState({});

  // State for patches
  const [patches, setPatches] = useState([]); // [{ id, x, y, width, height }]
  const [modifiedPatches, setModifiedPatches] = useState({}); // { [split]: { [imageName]: [patches...] } }

  // State for dataset split selection
  const [datasetSplit, setDatasetSplit] = useState('train'); // train, valid, test
  const [availableSplits, setAvailableSplits] = useState(['train', 'valid', 'test']); // Always include all splits by default

  // State for new class input
  const [newClassName, setNewClassName] = useState('');

  // State for rectangle dragging
  const [isDragging, setIsDragging] = useState(false);
  const [dragStartPos, setDragStartPos] = useState({ x: 0, y: 0 });
  const [dragStartAnnotation, setDragStartAnnotation] = useState(null);

  const [isClassWiseBatch, setIsClassWiseBatch] = useState(false);
  const [classWiseBatchClass, setClassWiseBatchClass] = useState(null);



  // State for resizing
  const [isResizing, setIsResizing] = useState(false);
  const [resizeHandle, setResizeHandle] = useState(null); // 'nw', 'ne', 'sw', 'se'

  // State for multiple selection
  const [selectedAnnotations, setSelectedAnnotations] = useState([]); // Array of selected annotation IDs

  // State for context menu
  const [contextMenu, setContextMenu] = useState({
    visible: false,
    x: 0,
    y: 0,
    annotation: null
  });

  const [isAutoAnnotating, setIsAutoAnnotating] = useState(false);

  // State for Smart Grouping
  const [isFindingSimilar, setIsFindingSimilar] = useState(false);
  const [similarityThreshold, setSimilarityThreshold] = useState(0.85); // Default 0.85
  const [groupingMatches, setGroupingMatches] = useState(null); // { count: 0, matches: [{imageIndex, annotationId}], targetClassId }
  const [groupingTargetClass, setGroupingTargetClass] = useState(null);

  // State for ghost annotation (preview for duplication)
  const [ghostAnnotation, setGhostAnnotation] = useState(null);

  const [deletedImages, setDeletedImages] = useState([]); // Array of strings e.g. "train/image1.jpg"

  // Auto-Save / Sync States
  const [autoSyncDirectory, setAutoSyncDirectory] = useState("");
  const [isAutoSyncEnabled, setIsAutoSyncEnabled] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState(null);
  const [isSyncing, setIsSyncing] = useState(false);

  const [customFilename, setCustomFilename] = useState(''); // State for custom download filename

  // Refs
  const stageRef = useRef();
  const imageRef = useRef();
  const drawingRectRef = useRef();
  const fileInputRef = useRef();

  // Current image data
  const currentImage = images[currentImageIndex];

  // Keyboard shortcuts for tools and views
  useEffect(() => {
    const onKeyDown = (e) => {
      const isCtrlOrCmd = e.ctrlKey || e.metaKey; // support Cmd on Mac
      const isShift = e.shiftKey;
      const key = (e.key || '').toLowerCase();

      // Show ghost annotation if Shift is pressed and an annotation is selected
      if (e.key === 'Shift') {
        // We need to trigger a re-render or check current mouse position, 
        // but since we don't have mouse position here, we rely on next mouse move 
        // or we track mouse position in state/ref?
        // Actually, let's just let handleMouseMove handle showing it, 
        // but we might need to force an update if mouse isn't moving.
        // For now, simpler: ghost appears on mouse move when shift is down.
      }

      if (isCtrlOrCmd) {
        // Prevent default browser actions for mapped shortcuts (e.g. Ctrl+S)
        if (['s', 'r', 'p', 'd', 'e'].includes(key)) e.preventDefault();

        switch (key) {
          case 's': // Ctrl/Cmd+S -> select tool
            setTool('select');
            setCurrentView('editor');
            break;
          case 'r': // Ctrl/Cmd+R -> rectangle tool
            setTool('rectangle');
            setCurrentView('editor');
            break;
          case 'p': // Ctrl/Cmd+P -> polygon tool
            setTool('polygon');
            setCurrentView('editor');
            break;
          case 'e': // Ctrl/Cmd+E -> patch tool
            setTool('patch');
            setCurrentView('editor');
            break;
          case 'd': // Ctrl/Cmd+D -> dashboard view
            setCurrentView('dashboard');
            break;
          // add more mappings here as needed
          default:
            break;
        }
      } else if (isShift && !isCtrlOrCmd && !e.altKey) {
        if (key === 'r') { // Shift+R -> patch tool
          e.preventDefault();
          setTool('patch');
          setCurrentView('editor');
        }
      }
    };

    const onKeyUp = (e) => {
      if (e.key === 'Shift') {
        setGhostAnnotation(null);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
    };
  }, [setTool, setCurrentView]);

  // Add keyboard shortcut for Delete/Backspace to remove selected annotations
  useEffect(() => {
    const onKeyDown = (e) => {
      // don't trigger when typing in inputs or editable elements
      const active = document.activeElement;
      if (active && (active.tagName === 'INPUT' || active.tagName === 'TEXTAREA' || active.isContentEditable)) {
        return;
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault();
        if (selectedAnnotations.length > 0) {
          handleMultipleAnnotationDelete();
        } else if (selectedAnnotation) {
          handleAnnotationDelete(selectedAnnotation.id);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [selectedAnnotations, selectedAnnotation, handleMultipleAnnotationDelete, handleAnnotationDelete]);

  // Function to get a consistent color for each class
  const getClassColor = (classId) => {
    const colors = [
      '#FF6B6B', '#4ECDC4', '#45B7D1', '#FFBE0B', '#FB5607',
      '#8338EC', '#3A86FF', '#06D6A0', '#118AB2', '#073B4C',
      '#EF476F', '#FFD166', '#073B4C', '#118AB2', '#06D6A0'
    ];
    return colors[classId % colors.length];
  };

  // Function to get images that contain annotations of a specific class
  const getImagesWithClass = (classId) => {
    return images.filter(image =>
      image.annotations && image.annotations.some(annotation => annotation.classId === classId)
    );
  };

  // Calculate current batch with class filtering
  const displayImages = isClassWiseBatch && classWiseBatchClass !== null
    ? getImagesWithClass(classWiseBatchClass)
    : images;

  const currentBatch = displayImages.slice(batchStartIndex, batchStartIndex + batchSize);
  const totalBatches = Math.ceil(displayImages.length / batchSize);
  const currentBatchIndex = Math.floor(batchStartIndex / batchSize) + 1;


  // const displayImages = getDisplayImages();
  // const currentBatch = displayImages.slice(batchStartIndex, batchStartIndex + batchSize);
  // const totalBatches = Math.ceil(displayImages.length / batchSize);
  // const currentBatchIndex = Math.floor(batchStartIndex / batchSize) + 1;

  // Handle file upload
  const onDrop = async (acceptedFiles) => {
    try {
      // Check if we're adding individual images to an existing dataset
      if (dataset && acceptedFiles.length > 0 && !acceptedFiles[0].name.endsWith('.zip')) {
        // Handle individual image uploads
        await handleIndividualImageUpload(acceptedFiles);
        return;
      }

      // If no dataset is loaded and we have a ZIP file, load the dataset
      if (!dataset && acceptedFiles.length > 0 && acceptedFiles[0].name.endsWith('.zip')) {
        const file = acceptedFiles[0];
        if (!file.name.endsWith('.zip')) {
          alert("Invalid file type. Please select a ZIP file containing your dataset.");
          return;
        }

        const zip = new JSZip();
        const content = await zip.loadAsync(file);

        // Check if the ZIP file is valid and contains files
        const fileCount = Object.keys(content.files).length;
        console.log("ZIP file structure - Total files:", fileCount);
        console.log("ZIP file contents:", Object.keys(content.files).slice(0, 20)); // Log first 20 files

        if (fileCount === 0) {
          alert("The selected ZIP file is empty. Please select a valid dataset ZIP file.");
          return;
        }

        // Extract dataset.yaml
        const configFile = content.file("dataset.yaml");
        let config = null;
        if (configFile) {
          try {
            const configText = await configFile.async("text");
            config = yaml.load(configText);
            setDatasetConfig(config); // Store original config
            setClasses(config.names || ['unknown']);
            setSelectedClass(config.names?.[0] || 'unknown');

            // Determine available splits from config
            const splits = [];
            if (config.train) splits.push('train');
            if (config.val) splits.push('valid');
            if (config.test) splits.push('test');

            // If no splits found in config, add default ones
            if (splits.length === 0) {
              splits.push('train');
              if (content.folder("valid") || content.folder("val")) splits.push('valid');
              if (content.folder("test")) splits.push('test');
            }

            setAvailableSplits(splits);
          } catch (yamlError) {
            console.error("Error parsing dataset.yaml:", yamlError);
            alert("Error parsing dataset.yaml. Using default configuration.");
            setAvailableSplits(['train', 'valid']);
          }
        } else {
          console.warn("No dataset.yaml found in the ZIP file. Using default configuration.");
          alert("No dataset.yaml found in the ZIP file. Using default configuration.");
          setAvailableSplits(['train', 'valid']);
        }

        // Initialize modifiedImages with empty objects for each split
        const initialModifiedImages = {};
        const splits = availableSplits.length > 0 ? availableSplits : ['train', 'valid'];
        splits.forEach(split => {
          initialModifiedImages[split] = {};
        });
        setModifiedImages(initialModifiedImages);

        loadDatasetForSplit(content, config, datasetSplit, initialModifiedImages);

        setDataset(file);
        return;
      }

      // If we have a dataset loaded and we're uploading a ZIP file, treat it as a new dataset
      if (dataset && acceptedFiles.length > 0 && acceptedFiles[0].name.endsWith('.zip')) {
        const file = acceptedFiles[0];
        const zip = new JSZip();
        const content = await zip.loadAsync(file);

        // Extract dataset.yaml
        const configFile = content.file("dataset.yaml");
        let config = null;
        if (configFile) {
          try {
            const configText = await configFile.async("text");
            config = yaml.load(configText);
            setDatasetConfig(config); // Store original config
            setClasses(config.names || ['unknown']);
            setSelectedClass(config.names?.[0] || 'unknown');

            // Determine available splits from config
            const splits = [];
            if (config.train) splits.push('train');
            if (config.val) splits.push('valid');
            if (config.test) splits.push('test');

            // If no splits found in config, add default ones
            if (splits.length === 0) {
              splits.push('train');
              if (content.folder("valid") || content.folder("val")) splits.push('valid');
              if (content.folder("test")) splits.push('test');
            }

            setAvailableSplits(splits);
          } catch (yamlError) {
            console.error("Error parsing dataset.yaml:", yamlError);
            alert("Error parsing dataset.yaml. Using default configuration.");
            setAvailableSplits(['train', 'valid']);
          }
        }

        // Initialize modifiedImages with empty objects for each split
        const initialModifiedImages = {};
        const initialModifiedPatches = {};
        const splits = availableSplits.length > 0 ? availableSplits : ['train', 'valid'];
        splits.forEach(split => {
          initialModifiedImages[split] = {};
          initialModifiedPatches[split] = {};
        });
        setModifiedImages(initialModifiedImages);
        setModifiedPatches(initialModifiedPatches);

        loadDatasetForSplit(content, config, datasetSplit, initialModifiedImages, initialModifiedPatches);

        setDataset(file);
        return;
      }

      // Handle individual image uploads when no dataset is loaded
      if (!dataset && acceptedFiles.length > 0) {
        await handleIndividualImageUpload(acceptedFiles);
        return;
      }
    } catch (error) {
      console.error("Error loading dataset:", error);
      alert("Error loading dataset. Please make sure it's a valid ZIP file with the correct structure.\nError: " + error.message);
    }
  };

  // Handle individual image uploads to current split
  const handleIndividualImageUpload = async (imageFiles) => {
    try {
      const validImageFiles = imageFiles.filter(file =>
        file.type.startsWith('image/') ||
        /\.(jpg|jpeg|png|gif)$/i.test(file.name)
      );

      if (validImageFiles.length === 0) {
        alert("No valid image files were selected.");
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
          annotations: []
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
          size: updatedImages.length
        };
        setDataset(dummyDataset);
      }

      alert(`Successfully added ${validImageFiles.length} images to the ${datasetSplit} split!`);
    } catch (error) {
      console.error("Error adding images:", error);
      alert("Error adding images. Please try again.");
    }
  };

  // Load dataset for a specific split
  const loadDatasetForSplit = async (content, config, split, currentModifiedImages = modifiedImages, currentModifiedPatches = modifiedPatches) => {
    try {
      // Extract images and annotations based on selected split
      const extractedImages = [];

      // Determine folder paths based on selected split
      let imageFolder, labelFolder;
      console.log(`Loading dataset for split: ${split}`);
      console.log(`Config:`, config);

      if (split === 'train') {
        // For train, we need to handle the path correctly
        const trainImagePath = config?.train || "train/images";
        const trainBasePath = trainImagePath.replace('/images', '');
        console.log(`Train image path: ${trainImagePath}, base path: ${trainBasePath}`);
        imageFolder = content.folder(trainBasePath) || content.folder("train") || content.folder("images");
        labelFolder = content.folder(trainBasePath ? `${trainBasePath}/labels` : "train/labels") || content.folder("train/labels") || content.folder("labels");
      } else if (split === 'valid') {
        // For valid, we need to handle the path correctly and check both 'val' and 'valid'
        const valImagePath = config?.val || "valid/images";
        const valBasePath = valImagePath.replace('/images', '');
        console.log(`Valid image path: ${valImagePath}, base path: ${valBasePath}`);
        // Try both 'valid' and 'val' folder names
        imageFolder = content.folder(valBasePath) || content.folder("valid") || content.folder("val") || content.folder("images");
        labelFolder = content.folder(valBasePath ? `${valBasePath}/labels` : "valid/labels") ||
          content.folder("valid/labels") ||
          content.folder("val/labels") ||
          content.folder("labels");
      } else if (split === 'test') {
        // For test, we need to handle the path correctly
        const testImagePath = config?.test || "test/images";
        const testBasePath = testImagePath.replace('/images', '');
        console.log(`Test image path: ${testImagePath}, base path: ${testBasePath}`);
        imageFolder = content.folder(testBasePath) || content.folder("test") || content.folder("images");
        labelFolder = content.folder(testBasePath ? `${testBasePath}/labels` : "test/labels") || content.folder("test/labels") || content.folder("labels");
      } else {
        // Default to train if split not found
        imageFolder = content.folder("train") || content.folder("images");
        labelFolder = content.folder("train/labels") || content.folder("labels");
      }

      console.log("Initial imageFolder found:", imageFolder !== null);
      console.log("Initial labelFolder found:", labelFolder !== null);

      // If we couldn't find the specific folder, try to find any image folder
      if (!imageFolder) {
        console.log("No standard image folder found, searching for any image folder...");
        // Try to find any folder with images
        const folders = Object.keys(content.files).filter(key => key.includes('/') && !key.includes('.')).map(key => key.split('/')[0]);
        const uniqueFolders = [...new Set(folders)];
        console.log("Unique folders found:", uniqueFolders);

        for (const folder of uniqueFolders) {
          const folderContent = content.folder(folder);
          const imageFiles = folderContent.file(/.*\.(jpg|jpeg|png)$/i);
          console.log(`Checking folder '${folder}': ${imageFiles.length} image files`);
          if (imageFiles.length > 0) {
            imageFolder = folderContent;
            console.log(`Found image folder: ${folder}`);
            break;
          }
        }

        // If still no image folder, try root level images
        if (!imageFolder) {
          console.log("No image folder found, using root directory");
          imageFolder = content;
        }

        // Set label folder to the same base or labels folder
        labelFolder = content.folder("labels") || content;
      }

      if (imageFolder) {
        const imageList = imageFolder.file(/.*\.(jpg|jpeg|png)$/i);

        for (let i = 0; i < imageList.length; i++) {
          const imageFile = imageList[i];
          const imageData = await imageFile.async("base64");
          const imageName = imageFile.name.split("/").pop();

          // Check if we have modified annotations for this image
          const imageKey = `${split}/${imageName}`;
          if (currentModifiedImages[split] && currentModifiedImages[split][imageKey]) {
            // Use modified annotations
            extractedImages.push({
              id: i,
              name: imageName,
              src: `data:image/jpeg;base64,${imageData}`,
              annotations: currentModifiedImages[split][imageKey]
            });
          } else {
            // Load original annotations
            const labelFileName = imageName.replace(/\.[^/.]+$/, ".txt");
            let labelFile = labelFolder?.file(labelFileName);

            // If not found, try to find in the same folder as the image
            if (!labelFile && imageFile.name.includes('/')) {
              const imagePathParts = imageFile.name.split('/');
              imagePathParts.pop(); // Remove filename
              const imageFolderPath = imagePathParts.join('/');
              const imageBaseFolder = content.folder(imageFolderPath);
              if (imageBaseFolder) {
                const labelsFolderPath = imageFolderPath.replace('/images', '/labels');
                const labelsFolder = content.folder(labelsFolderPath);
                labelFile = labelsFolder?.file(labelFileName) || imageBaseFolder.file(labelFileName);
              }
            }

            let imageAnnotations = [];
            if (labelFile) {
              const labelContent = await labelFile.async("text");
              imageAnnotations = parseAnnotations(labelContent);
            }

            // Load patches if any
            let imagePatches = [];
            if (currentModifiedPatches[split] && currentModifiedPatches[split][imageKey]) {
              imagePatches = currentModifiedPatches[split][imageKey];
            }

            extractedImages.push({
              id: i,
              name: imageName,
              src: `data:image/jpeg;base64,${imageData}`,
              annotations: imageAnnotations,
              patches: imagePatches
            });
          }
        }

        setImages(extractedImages);
        if (extractedImages.length > 0) {
          setAnnotations(extractedImages[0].annotations);
          setPatches(extractedImages[0].patches || []);
          setCurrentImageIndex(0);
        } else {
          setAnnotations([]);
          setPatches([]);
          setCurrentImageIndex(0);
        }

        // Reset selections
        setSelectedAnnotation(null);
        setNewAnnotation(null);
        setEditingAnnotation(null);
        setHoveredAnnotation(null);
        setSelectedAnnotations([]);
      } else {
        console.warn(`No image folder found for split ${split}`);
        console.warn("Available files:", Object.keys(content.files).slice(0, 30));
        alert(`Warning: No images found for the ${split} split. The ZIP file may have a different structure than expected.`);
      }
    } catch (error) {
      console.error("Error loading dataset for split:", error);
      alert("Error loading dataset for the selected split:\n" + error.message + "\n\nPlease check the browser console (F12) for more details.");
    }
  };

  // Handle dataset split change
  const handleDatasetSplitChange = async (newSplit) => {
    // Save current annotations to modifiedImages before switching
    const updatedModifiedImages = { ...modifiedImages };
    const updatedModifiedPatches = { ...modifiedPatches };

    if (dataset && images.length > 0) {
      // Save current image annotations
      const currentImageName = images[currentImageIndex]?.name;
      if (currentImageName) {
        const imageKey = `${datasetSplit}/${currentImageName}`;

        if (!updatedModifiedImages[datasetSplit]) {
          updatedModifiedImages[datasetSplit] = {};
        }
        updatedModifiedImages[datasetSplit][imageKey] = annotations;

        if (!updatedModifiedPatches[datasetSplit]) {
          updatedModifiedPatches[datasetSplit] = {};
        }
        updatedModifiedPatches[datasetSplit][imageKey] = patches;
      }

      setModifiedImages(updatedModifiedImages);
      setModifiedPatches(updatedModifiedPatches);
    }

    // Always Load the new split with modified images and patches
    if (dataset) {
      try {
        const zip = new JSZip();
        // dataset can be a File or Blob, from manual upload or Auto-Save load
        const content = await zip.loadAsync(dataset);
        setDatasetSplit(newSplit);
        loadDatasetForSplit(content, datasetConfig, newSplit, updatedModifiedImages, updatedModifiedPatches);
      } catch (error) {
        console.error("Error loading dataset for split:", error);
        alert("Error loading dataset for the selected split: " + error.message);
      }
    } else {
      // Should not happen, but safe fallback
      setDatasetSplit(newSplit);
    }
  };

  const { getRootProps, getInputProps, isDragActive } = useDropzone({ onDrop });

  // Helper function to normalize folder paths (handle both 'val' and 'valid')
  const getNormalizeFolderName = (folderName) => {
    if (folderName === 'val') return 'valid';
    return folderName;
  };

  // Parse YOLO annotations
  const parseAnnotations = (content) => {
    const lines = content.trim().split('\n');
    const parsedAnnotations = [];

    lines.forEach((line, index) => {
      if (line.trim()) {
        const [classId, centerX, centerY, width, height] = line.trim().split(' ').map(Number);
        parsedAnnotations.push({
          id: index,
          classId: classId || 0,
          centerX: centerX || 0,
          centerY: centerY || 0,
          width: width || 0,
          height: height || 0,
          type: 'rectangle'
        });
      }
    });

    return parsedAnnotations;
  };

  // Convert normalized coordinates to pixel coordinates
  const normalizedToPixel = (annotation, imageWidth, imageHeight) => {
    return {
      x: annotation.centerX * imageWidth,
      y: annotation.centerY * imageHeight,
      width: annotation.width * imageWidth,
      height: annotation.height * imageHeight
    };
  };

  // Convert pixel coordinates to normalized coordinates
  const pixelToNormalized = (x, y, width, height, imageWidth, imageHeight) => {
    return {
      centerX: x / imageWidth,
      centerY: y / imageHeight,
      width: width / imageWidth,
      height: height / imageHeight
    };
  };

  // Handle image selection
  const handleImageSelect = (index) => {
    // Save current annotations to modifiedImages before switching images
    if (images.length > 0 && currentImageIndex < images.length) {
      const updatedModifiedImages = { ...modifiedImages };
      const updatedModifiedPatches = { ...modifiedPatches };
      const currentImageName = images[currentImageIndex]?.name;

      if (currentImageName) {
        const imageKey = `${datasetSplit}/${currentImageName}`;

        // Save annotations
        if (!updatedModifiedImages[datasetSplit]) {
          updatedModifiedImages[datasetSplit] = {};
        }
        updatedModifiedImages[datasetSplit][imageKey] = annotations;

        // Save patches
        if (!updatedModifiedPatches[datasetSplit]) {
          updatedModifiedPatches[datasetSplit] = {};
        }
        updatedModifiedPatches[datasetSplit][imageKey] = patches;
      }
      setModifiedImages(updatedModifiedImages);
      setModifiedPatches(updatedModifiedPatches);
    }

    setCurrentImageIndex(index);
    setAnnotations(images[index].annotations || []);
    setPatches(images[index].patches || []);
    setSelectedAnnotation(null);
    setNewAnnotation(null);
    setEditingAnnotation(null);
    setHoveredAnnotation(null);
  };

  // Handle mouse down for drawing, dragging, or resizing
  // Helper to bake patches into image
  const bakePatchesIntoImage = async (imageSrc, imagePatches) => {
    if (!imagePatches || imagePatches.length === 0) return imageSrc;

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        canvas.width = img.width;
        canvas.height = img.height;
        const ctx = canvas.getContext('2d');

        // Draw original image
        ctx.drawImage(img, 0, 0);

        // Draw patches
        ctx.fillStyle = 'white';
        imagePatches.forEach(patch => {
          // Convert normalized coordinates to pixels
          const x = patch.x * img.width;
          const y = patch.y * img.height;
          const w = patch.width * img.width;
          const h = patch.height * img.height;
          ctx.fillRect(x, y, w, h);
        });

        resolve(canvas.toDataURL('image/jpeg', 0.95));
      };
      img.src = imageSrc;
    });
  };

  // Helper to update patches for current image
  const updateImagePatches = (index, updatedPatches) => {
    // Determine the split to use (default to current if not specified)
    // Note: This matches updateImageAnnotations logic pattern
    const updatedImages = [...images];
    if (updatedImages[index]) {
      updatedImages[index].patches = updatedPatches;
      setImages(updatedImages);
    }

    const updatedModifiedPatches = { ...modifiedPatches };
    const currentImageName = updatedImages[index]?.name;
    if (currentImageName) {
      const imageKey = `${datasetSplit}/${currentImageName}`;
      if (!updatedModifiedPatches[datasetSplit]) {
        updatedModifiedPatches[datasetSplit] = {};
      }
      updatedModifiedPatches[datasetSplit][imageKey] = updatedPatches;
      setModifiedPatches(updatedModifiedPatches);
    }
  };

  // Handle undo patch
  const handleUndoPatch = () => {
    if (patches.length > 0) {
      const updatedPatches = patches.slice(0, -1);
      setPatches(updatedPatches);
      updateImagePatches(currentImageIndex, updatedPatches);
    }
  };

  // Keyboard shortcut for undoing patch
  useEffect(() => {
    const onKeyDown = (e) => {
      const mod = e.ctrlKey || e.metaKey;
      if (mod && (e.key === 'z' || e.key === 'Z')) {
        e.preventDefault();
        handleUndoPatch();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [patches, currentImageIndex]);

  const handleMouseDown = (e) => {
    if (!currentImage) return;

    // Only allow left-click for tool actions (drawing, selecting, resizing)
    // Middle-click (button 1) will fall through to handleStageMouseDown for panning
    if (e.evt.button !== 0) return;

    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();

    // Transform pointer position to account for scale and position
    const x = (pointer.x - stagePos.x) / scale;
    const y = (pointer.y - stagePos.y) / scale;


    // Update ghost annotation for duplication preview
    if (tool === 'select' && selectedAnnotation && e.evt.shiftKey) {
      setGhostAnnotation({
        x: x - (selectedAnnotation.width * stageSize.width) / 2, // Centered
        y: y - (selectedAnnotation.height * stageSize.height) / 2,
        width: selectedAnnotation.width * stageSize.width,
        height: selectedAnnotation.height * stageSize.height,
        classId: selectedAnnotation.classId
      });
    } else {
      setGhostAnnotation(null);
    }

    // Check if we clicked on an existing annotation (for dragging or resizing)
    // DUPLICATION LOGIC: Shift + Click with Select tool and an annotation selected
    if (tool === 'select' && selectedAnnotation && e.evt.shiftKey) {
      // Create a new annotation with the same dimensions as the selected one, centered at cursor
      const newAnn = {
        id: annotations.length > 0 ? Math.max(...annotations.map(a => a.id)) + 1 : 0,
        classId: selectedAnnotation.classId,
        centerX: x / stageSize.width,
        centerY: y / stageSize.height,
        width: selectedAnnotation.width,
        height: selectedAnnotation.height,
        type: selectedAnnotation.type
      };

      const updatedAnnotations = [...annotations, newAnn];
      setAnnotations(updatedAnnotations);

      // Update modified images for persistence
      updateImageAnnotations(currentImageIndex, updatedAnnotations);

      // Select the new annotation? Maybe keep old one selected for rapid duplication?
      // Let's keep the old one selected so user can just click multiple times
      return;
    }

    if (tool === 'select' && selectedAnnotation) {
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
      if (x >= rectX - handleSize && x <= rectX + handleSize &&
        y >= rectY - handleSize && y <= rectY + handleSize) {
        setIsResizing(true);
        setResizeHandle('nw');
        setDragStartPos({ x, y });
        setDragStartAnnotation({ ...selectedAnnotation });
        return;
      }

      // Northeast handle
      if (x >= rectX + rectWidth - handleSize && x <= rectX + rectWidth + handleSize &&
        y >= rectY - handleSize && y <= rectY + handleSize) {
        setIsResizing(true);
        setResizeHandle('ne');
        setDragStartPos({ x, y });
        setDragStartAnnotation({ ...selectedAnnotation });
        return;
      }

      // Southwest handle
      if (x >= rectX - handleSize && x <= rectX + handleSize &&
        y >= rectY + rectHeight - handleSize && y <= rectY + rectHeight + handleSize) {
        setIsResizing(true);
        setResizeHandle('sw');
        setDragStartPos({ x, y });
        setDragStartAnnotation({ ...selectedAnnotation });
        return;
      }

      // Southeast handle
      if (x >= rectX + rectWidth - handleSize && x <= rectX + rectWidth + handleSize &&
        y >= rectY + rectHeight - handleSize && y <= rectY + rectHeight + handleSize) {
        setIsResizing(true);
        setResizeHandle('se');
        setDragStartPos({ x, y });
        setDragStartAnnotation({ ...selectedAnnotation });
        return;
      }

      // Check if click is within the selected annotation (for dragging)
      if (x >= rectX && x <= rectX + rectWidth &&
        y >= rectY && y <= rectY + rectHeight) {
        setIsDragging(true);
        setDragStartPos({ x, y });
        setDragStartAnnotation({ ...selectedAnnotation });
        return;
      }
    }

    // Start drawing if tool is rectangle or patch
    if (tool === 'rectangle' || tool === 'patch') {
      setIsDrawing(true);
      // Deselect if drawing
      if (selectedAnnotation) {
        setSelectedAnnotation(null);
        setEditingAnnotation(null);
      }

      setNewAnnotation({
        x,
        y,
        width: 0,
        height: 0,
        type: tool // 'rectangle' or 'patch'
      });
    }
  };

  // Handle mouse move for drawing, dragging, resizing, or panning
  const handleMouseMove = (e) => {
    if (!currentImage) return;

    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();

    // Transform pointer position to account for scale and position
    const x = (pointer.x - stagePos.x) / scale;
    const y = (pointer.y - stagePos.y) / scale;

    // Update crosshair position
    setCrosshairPos({ x, y });

    // Update ghost annotation for duplication preview
    if (tool === 'select' && selectedAnnotation && e.evt.shiftKey) {
      setGhostAnnotation({
        x: x - (selectedAnnotation.width * stageSize.width) / 2, // Centered
        y: y - (selectedAnnotation.height * stageSize.height) / 2,
        width: selectedAnnotation.width * stageSize.width,
        height: selectedAnnotation.height * stageSize.height,
        classId: selectedAnnotation.classId
      });
    } else {
      setGhostAnnotation(null);
    }

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

      const origX = origPixelCoords.x - origPixelCoords.width / 2;
      const origY = origPixelCoords.y - origPixelCoords.height / 2;
      const origWidth = origPixelCoords.width;
      const origHeight = origPixelCoords.height;

      let newCenterX, newCenterY, newWidth, newHeight;

      // Calculate new dimensions based on which handle is being dragged
      switch (resizeHandle) {
        case 'nw': // Northwest (top-left)
          newWidth = origWidth - dx;
          newHeight = origHeight - dy;
          newCenterX = origPixelCoords.x - dx / 2;
          newCenterY = origPixelCoords.y - dy / 2;
          break;
        case 'ne': // Northeast (top-right)
          newWidth = origWidth + dx;
          newHeight = origHeight - dy;
          newCenterX = origPixelCoords.x + dx / 2;
          newCenterY = origPixelCoords.y - dy / 2;
          break;
        case 'sw': // Southwest (bottom-left)
          newWidth = origWidth - dx;
          newHeight = origHeight + dy;
          newCenterX = origPixelCoords.x - dx / 2;
          newCenterY = origPixelCoords.y + dy / 2;
          break;
        case 'se': // Southeast (bottom-right)
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
        height: normalized.height
      };

      const updatedAnnotations = annotations.map(ann =>
        ann.id === selectedAnnotation.id ? updatedAnnotation : ann
      );

      setAnnotations(updatedAnnotations);

      // Update the image in the images array and modifiedImages
      updateImageAnnotations(currentImageIndex, updatedAnnotations);

      // Update selected annotation
      setSelectedAnnotation(updatedAnnotation);
      setEditingAnnotation({ ...editingAnnotation, ...updatedAnnotation });

      return;
    }

    // Handle dragging of existing annotation
    if (isDragging && selectedAnnotation && dragStartAnnotation) {
      const dx = x - dragStartPos.x;
      const dy = y - dragStartPos.y;

      // Calculate new center position
      const newCenterX = dragStartAnnotation.centerX + (dx / stageSize.width);
      const newCenterY = dragStartAnnotation.centerY + (dy / stageSize.height);

      // Update the annotation
      const updatedAnnotations = annotations.map(ann =>
        ann.id === selectedAnnotation.id
          ? { ...ann, centerX: newCenterX, centerY: newCenterY }
          : ann
      );

      setAnnotations(updatedAnnotations);

      // Update the image in the images array and modifiedImages
      updateImageAnnotations(currentImageIndex, updatedAnnotations);

      // Update selected annotation
      setSelectedAnnotation({ ...selectedAnnotation, centerX: newCenterX, centerY: newCenterY });
      setEditingAnnotation({ ...editingAnnotation, centerX: newCenterX, centerY: newCenterY });

      return;
    }

    // Handle drawing new annotation
    if (isDrawing && newAnnotation) {
      setNewAnnotation({
        ...newAnnotation,
        width: x - newAnnotation.x,
        height: y - newAnnotation.y
      });
      return;
    }

    // Handle panning (when dragging on empty space with middle mouse button)
    if (e.evt.buttons === 4) {
      const deltaX = pointer.x - (dragStartPos.x * scale + stagePos.x);
      const deltaY = pointer.y - (dragStartPos.y * scale + stagePos.y);

      setStagePos({
        x: stagePos.x + deltaX,
        y: stagePos.y + deltaY
      });
    }
  };

  // Update the image in the images array and modifiedImages
  const updateImageAnnotations = (imageIndex, updatedAnnotations) => {
    // Update images state
    const updatedImages = [...images];
    updatedImages[imageIndex] = {
      ...updatedImages[imageIndex],
      annotations: updatedAnnotations
    };
    setImages(updatedImages);

    // Update modifiedImages state
    const updatedModifiedImages = { ...modifiedImages };
    const imageName = images[imageIndex]?.name;
    if (imageName) {
      const imageKey = `${datasetSplit}/${imageName}`;
      if (!updatedModifiedImages[datasetSplit]) {
        updatedModifiedImages[datasetSplit] = {};
      }
      updatedModifiedImages[datasetSplit][imageKey] = updatedAnnotations;
      setModifiedImages(updatedModifiedImages);
    }

    return updatedImages;
  };

  // Handle mouse up for drawing, dragging, or resizing
  const handleMouseUp = (e) => {
    if (!currentImage) return;

    // Reset states
    if (isDragging || isResizing) {
      setIsDragging(false);
      setIsResizing(false);
      setResizeHandle(null);
      setDragStartPos({ x: 0, y: 0 });
      setDragStartAnnotation(null);
      return;
    }

    // Handle drawing new annotation or patch
    if (isDrawing && newAnnotation) {
      // Create properties based on tool
      const imageWidth = stageSize.width;
      const imageHeight = stageSize.height;

      // Calculate normalized coordinates
      const normalized = pixelToNormalized(
        Math.min(newAnnotation.x, newAnnotation.x + newAnnotation.width),
        Math.min(newAnnotation.y, newAnnotation.y + newAnnotation.height),
        Math.abs(newAnnotation.width),
        Math.abs(newAnnotation.height),
        imageWidth,
        imageHeight
      );

      if (newAnnotation.type === 'patch') {
        if (Math.abs(newAnnotation.width) > 5 && Math.abs(newAnnotation.height) > 5) {
          const newPatch = {
            id: Date.now(),
            x: normalized.centerX,
            y: normalized.centerY,
            width: normalized.width,
            height: normalized.height
          };
          const updatedPatches = [...patches, newPatch];
          setPatches(updatedPatches);
          updateImagePatches(currentImageIndex, updatedPatches);
        }
      } else {
        // Only create annotation if it has meaningful size
        if (Math.abs(newAnnotation.width) > 5 && Math.abs(newAnnotation.height) > 5) {
          // Create a new rectangle annotation
          let classIndex = classes.indexOf(selectedClass);
          if (classIndex === -1) classIndex = 0; // Fallback to first class if not found

          const newAnnotationObj = {
            id: Date.now(),
            classId: classIndex,
            centerX: normalized.centerX + normalized.width / 2,
            centerY: normalized.centerY + normalized.height / 2,
            width: normalized.width,
            height: normalized.height,
            type: 'rectangle'
          };

          const updatedAnnotations = [...annotations, newAnnotationObj];
          setAnnotations(updatedAnnotations);

          // Update the image in the images array and modifiedImages
          updateImageAnnotations(currentImageIndex, updatedAnnotations);
        }
      }
      // Reset drawing state
      setIsDrawing(false);
      setNewAnnotation(null);
      return;
    }
  };

  // Handle annotation selection (single or multiple with Ctrl)
  const handleAnnotationSelect = (annotation, event) => {
    // Check if Ctrl key is pressed for multiple selection
    if (event && event.ctrlKey) {
      // Toggle selection in multiple selection mode
      if (selectedAnnotations.some(id => id === annotation.id)) {
        // Remove from selection
        setSelectedAnnotations(selectedAnnotations.filter(id => id !== annotation.id));
      } else {
        // Add to selection
        setSelectedAnnotations([...selectedAnnotations, annotation.id]);
      }
      // Clear single selection when in multiple selection mode
      setSelectedAnnotation(null);
      setEditingAnnotation(null);
    } else {
      // Single selection mode
      setSelectedAnnotation(annotation);
      setSelectedAnnotations([annotation.id]); // Only this annotation is selected
      setEditingAnnotation({ ...annotation }); // Create a copy for editing
    }

    setHoveredAnnotation(null);
  };

  // Handle annotation deletion
  const handleAnnotationDelete = (annotationId) => {
    const updatedAnnotations = annotations.filter(ann => ann.id !== annotationId);
    setAnnotations(updatedAnnotations);

    // Update the image in the images array and modifiedImages
    updateImageAnnotations(currentImageIndex, updatedAnnotations);

    if (selectedAnnotation && selectedAnnotation.id === annotationId) {
      setSelectedAnnotation(null);
      setEditingAnnotation(null);
    }

    if (hoveredAnnotation && hoveredAnnotation.id === annotationId) {
      setHoveredAnnotation(null);
    }
  };

  // Handle right-click context menu
  const handleContextMenu = (event, annotation) => {
    event.evt.preventDefault();

    // If using select tool, right-click deletes the annotation immediately
    if (tool === 'select') {
      handleAnnotationDelete(annotation.id);
      return;
    }

    const stage = event.target.getStage();
    const pointer = stage.getPointerPosition();

    setContextMenu({
      visible: true,
      x: pointer.x,
      y: pointer.y,
      annotation: annotation
    });
  };

  // Close context menu
  const closeContextMenu = () => {
    setContextMenu({
      visible: false,
      x: 0,
      y: 0,
      annotation: null
    });
  };

  // Context menu options
  const getContextMenuOptions = () => {
    return [
      {
        label: 'Delete',
        icon: '🗑️',
        action: (annotation) => {
          if (annotation) {
            handleAnnotationDelete(annotation.id);
          }
        }
      },
      {
        label: 'Select',
        icon: '👆',
        action: (annotation) => {
          if (annotation) {
            handleAnnotationSelect(annotation);
          }
        }
      },
      {
        label: 'Edit Class',
        icon: '🏷️',
        action: (annotation) => {
          if (annotation) {
            handleAnnotationSelect(annotation);
            // Scroll to edit panel if not visible
            const editPanel = document.querySelector('.annotation-edit-panel');
            if (editPanel) {
              editPanel.scrollIntoView({ behavior: 'smooth' });
            }
          }
        }
      }
    ];
  };

  // Handle multiple annotation deletion
  const handleMultipleAnnotationDelete = () => {
    if (selectedAnnotations.length === 0) return;

    // Filter out selected annotations
    const updatedAnnotations = annotations.filter(ann => !selectedAnnotations.includes(ann.id));
    setAnnotations(updatedAnnotations);

    // Update the image in the images array and modifiedImages
    updateImageAnnotations(currentImageIndex, updatedAnnotations);

    // Clear selection
    setSelectedAnnotations([]);
    setSelectedAnnotation(null);
    setEditingAnnotation(null);

    alert(`Deleted ${selectedAnnotations.length} annotations`);
  };

  // Handle annotation class change
  const handleAnnotationClassChange = (annotationId, newClassId) => {
    const updatedAnnotations = annotations.map(ann =>
      ann.id === annotationId ? { ...ann, classId: newClassId } : ann
    );
    setAnnotations(updatedAnnotations);

    // Update the image in the images array and modifiedImages
    updateImageAnnotations(currentImageIndex, updatedAnnotations);

    // Update selected annotation if it's the one being edited
    if (selectedAnnotation && selectedAnnotation.id === annotationId) {
      setSelectedAnnotation({ ...selectedAnnotation, classId: newClassId });
      setEditingAnnotation({ ...editingAnnotation, classId: newClassId });
    }

    // Update hovered annotation if it's the one being edited
    if (hoveredAnnotation && hoveredAnnotation.id === annotationId) {
      setHoveredAnnotation({ ...hoveredAnnotation, classId: newClassId });
    }
  };

  // Handle annotation size change
  const handleAnnotationSizeChange = (annotationId, newWidth, newHeight) => {
    const updatedAnnotations = annotations.map(ann =>
      ann.id === annotationId ? { ...ann, width: newWidth, height: newHeight } : ann
    );
    setAnnotations(updatedAnnotations);

    // Update the image in the images array and modifiedImages
    updateImageAnnotations(currentImageIndex, updatedAnnotations);

    // Update selected annotation if it's the one being edited
    if (selectedAnnotation && selectedAnnotation.id === annotationId) {
      setSelectedAnnotation({ ...selectedAnnotation, width: newWidth, height: newHeight });
      setEditingAnnotation({ ...editingAnnotation, width: newWidth, height: newHeight });
    }

    // Update hovered annotation if it's the one being edited
    if (hoveredAnnotation && hoveredAnnotation.id === annotationId) {
      setHoveredAnnotation({ ...hoveredAnnotation, width: newWidth, height: newHeight });
    }
  };

  // Handle zoom
  const handleZoom = (e) => {
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
      y: pointer.y - (pointer.y - stage.y()) * (newScale / oldScale)
    };

    stage.position(newPos);
    setScale(newScale);
    setStagePos(newPos);
  };

  // Handle mouse move for crosshair
  const handleStageMouseMove = (e) => {
    if (!currentImage) return;

    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();

    // Transform pointer position to account for scale and position
    const x = (pointer.x - stagePos.x) / scale;
    const y = (pointer.y - stagePos.y) / scale;

    setCrosshairPos({ x, y });
  };

  // Handle mouse enter/leave for crosshair visibility
  const handleStageMouseEnter = () => {
    setShowCrosshair(true);
  };

  const handleStageMouseLeave = () => {
    setShowCrosshair(false);
  };

  // Add drag start position tracking
  const handleStageMouseDown = (e) => {
    const stage = e.target.getStage();
    const pointer = stage.getPointerPosition();

    // Store initial drag position for panning
    setDragStartPos({
      x: (pointer.x - stagePos.x) / scale,
      y: (pointer.y - stagePos.y) / scale
    });
  };

  // Navigation functions
  const goToPreviousImage = () => {
    if (currentImageIndex > 0) {
      handleImageSelect(currentImageIndex - 1);
    }
  };

  const goToNextImage = () => {
    if (currentImageIndex < images.length - 1) {
      handleImageSelect(currentImageIndex + 1);
    }
  };

  const goToFirstImage = () => {
    if (images.length > 0) {
      handleImageSelect(0);
    }
  };

  const goToLastImage = () => {
    if (images.length > 0) {
      handleImageSelect(images.length - 1);
    }
  };

  // Delete current image
  const handleDeleteImage = () => {
    if (!currentImage) return;

    if (!window.confirm(`Are you sure you want to delete image "${currentImage.name}"? This will exclude it from downloads.`)) {
      return;
    }

    const imageKey = `${datasetSplit}/${currentImage.name}`;
    setDeletedImages(prev => [...prev, imageKey]);

    // Remove from images list
    const newImages = images.filter((_, index) => index !== currentImageIndex);
    setImages(newImages);

    // Update current index
    if (newImages.length > 0) {
      if (currentImageIndex >= newImages.length) {
        setCurrentImageIndex(newImages.length - 1);
      } else {
        // Keep current index (which is now the next image)
        // But we need to update annotations for the new current image
        setAnnotations(newImages[currentImageIndex].annotations || []);
      }
    } else {
      setCurrentImageIndex(0);
      setAnnotations([]);
    }
  };

  // Batch navigation
  const goToPreviousBatch = () => {
    if (batchStartIndex >= batchSize) {
      setBatchStartIndex(batchStartIndex - batchSize);
    }
  };

  const goToNextBatch = () => {
    if (batchStartIndex + batchSize < images.length) {
      setBatchStartIndex(batchStartIndex + batchSize);
    }
  };

  // Save annotations
  const saveAnnotations = () => {
    // Save current annotations to modifiedImages
    if (images.length > 0 && currentImageIndex < images.length) {
      const updatedModifiedImages = { ...modifiedImages };

      // Save current image annotations
      const currentImageName = images[currentImageIndex]?.name;
      if (currentImageName) {
        const imageKey = `${datasetSplit}/${currentImageName}`;
        if (!updatedModifiedImages[datasetSplit]) {
          updatedModifiedImages[datasetSplit] = {};
        }
        updatedModifiedImages[datasetSplit][imageKey] = annotations;
        setModifiedImages(updatedModifiedImages);
      }
    }

    alert("Annotations saved successfully!");
    // In a real implementation, this would save to the dataset files
  };

  // Handle auto-annotation with YOLO for ALL images
  const handleAutoAnnotate = async () => {
    if (images.length === 0) return;

    if (!window.confirm(`Auto-annotate all ${images.length} images in the current split? This process may take some time.`)) {
      return;
    }

    setIsAutoAnnotating(true);
    let successCount = 0;
    let totalAnnotationsAdded = 0;

    // Create local copies to avoid state issues during async loop
    let currentClasses = [...classes];
    let classListChanged = false;

    // We'll update a copy of images array
    const newImages = [...images];

    // We'll also prepare the modifiedImages update
    const nextModifiedImages = { ...modifiedImages };
    if (!nextModifiedImages[datasetSplit]) {
      nextModifiedImages[datasetSplit] = {};
    }
    const splitCache = nextModifiedImages[datasetSplit];

    try {
      for (let i = 0; i < newImages.length; i++) {
        const image = newImages[i];

        try {
          // Convert base64 to blob
          const base64Data = image.src.split(',')[1];
          const byteCharacters = atob(base64Data);
          const byteNumbers = new Array(byteCharacters.length);
          for (let j = 0; j < byteCharacters.length; j++) {
            byteNumbers[j] = byteCharacters.charCodeAt(j);
          }
          const byteArray = new Uint8Array(byteNumbers);
          const blob = new Blob([byteArray], { type: 'image/jpeg' });

          const formData = new FormData();
          formData.append('file', blob, image.name || `image_${i}.jpg`);

          const response = await fetch('http://localhost:8000/predict', {
            method: 'POST',
            body: formData,
          });

          if (!response.ok) continue; // Skip failed images

          const data = await response.json();

          if (data.annotations && data.annotations.length > 0) {
            // Sync classes
            if (data.modelClasses) {
              const modelClassNames = Object.values(data.modelClasses);
              modelClassNames.forEach(name => {
                if (!currentClasses.includes(name)) {
                  currentClasses.push(name);
                  classListChanged = true;
                }
              });
            }

            // Map predictions
            const newPredictions = data.annotations.map((ann, idx) => {
              const editorClassId = currentClasses.indexOf(ann.className);
              return {
                id: Date.now() + idx + (i * 100), // Ensure unique IDs
                classId: editorClassId !== -1 ? editorClassId : ann.classId,
                centerX: ann.centerX,
                centerY: ann.centerY,
                width: ann.width, // Provide fallback if undefined? No, backend provides it.
                height: ann.height,
                type: 'rectangle'
              };
            });

            // Add to existing annotations (append)
            const existingAnns = image.annotations || [];
            const mergedAnns = [...existingAnns, ...newPredictions];

            // Update image object
            newImages[i] = {
              ...image,
              annotations: mergedAnns
            };

            // Update cache
            const imageKey = `${datasetSplit}/${image.name}`;
            splitCache[imageKey] = mergedAnns;

            successCount++;
            totalAnnotationsAdded += newPredictions.length;
          }
        } catch (err) {
          console.error(`Error processing image ${i} (${image.name})`, err);
        }
      }

      // Batch state updates
      if (classListChanged) {
        setClasses(currentClasses);
      }

      setImages(newImages);
      setModifiedImages(nextModifiedImages);

      // Update current displayed annotations if current image was affected
      if (newImages[currentImageIndex]) {
        setAnnotations(newImages[currentImageIndex].annotations);
      }

      alert(`Auto-annotation complete!\nProcessed ${newImages.length} images.\nAdded ${totalAnnotationsAdded} annotations to ${successCount} images.`);

    } catch (error) {
      console.error("Error during batch auto-annotation:", error);
      alert("Error during batch auto-annotation: " + error.message);
    } finally {
      setIsAutoAnnotating(false);
    }
  };

  // Extract crop for similarity search
  const extractCrop = (imageSrc, annotation) => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const pixelW = annotation.width * img.width;
        const pixelH = annotation.height * img.height;
        const pixelX = (annotation.centerX * img.width) - (pixelW / 2);
        const pixelY = (annotation.centerY * img.height) - (pixelH / 2);

        // Ensure valid dimensions
        if (pixelW <= 0 || pixelH <= 0) {
          resolve(null);
          return;
        }

        canvas.width = pixelW;
        canvas.height = pixelH;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, pixelX, pixelY, pixelW, pixelH, 0, 0, pixelW, pixelH);
        resolve(canvas.toDataURL('image/jpeg'));
      };
      img.onerror = () => resolve(null);
      img.src = imageSrc;
    });
  };

  // Handle Find Similar
  const handleFindSimilar = async () => {
    if (selectedAnnotations.length === 0) return;
    setIsFindingSimilar(true);

    try {
      // 1. Prepare Target Crops
      // Filter current image annotations to get the selected ones
      const targetAnns = annotations.filter(a => selectedAnnotations.includes(a.id));
      const targetCrops = [];

      for (const ann of targetAnns) {
        const crop = await extractCrop(currentImage.src, ann);
        if (crop) targetCrops.push(crop);
      }

      if (targetCrops.length === 0) {
        alert("Could not extract target crops.");
        setIsFindingSimilar(false);
        return;
      }

      // 2. Prepare Candidate Crops (All annotations from all images)
      const candidates = []; // Metadata: { imageIndex, annotationId }
      const candidateCrops = []; // Base64 strings

      // Optimization: Process images sequentially to avoid memory spike?
      // Or chunk them. For now, sequential.
      for (let i = 0; i < images.length; i++) {
        const img = images[i];
        if (!img.annotations || img.annotations.length === 0) continue;

        for (const ann of img.annotations) {
          // Skip the targets themselves? No, they should match ideally.
          // But we don't want to double count or we do? 
          // Let's include everything.

          const crop = await extractCrop(img.src, ann);
          if (crop) {
            candidates.push({ imageIndex: i, annotationId: ann.id });
            candidateCrops.push(crop);
          }
        }
      }

      if (candidateCrops.length === 0) {
        alert("No candidates found in dataset.");
        setIsFindingSimilar(false);
        return;
      }

      // 3. Call Backend
      // 3. Call Backend
      const response = await fetch('http://localhost:8000/find_similar', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          target_crops: targetCrops,
          candidate_crops: candidateCrops,
          threshold: similarityThreshold
        })
      });

      if (!response.ok) {
        throw new Error("Backend error: " + response.statusText);
      }

      const result = await response.json();
      const matchIndices = result.match_indices; // Indices of candidateCrops

      // 4. Process Results
      const matchedMetadata = matchIndices.map(idx => candidates[idx]);

      setGroupingMatches(matchedMetadata);
      // Determine a default target class (take from first target)
      setGroupingTargetClass(targetAnns[0].classId);

      alert(`Found ${matchedMetadata.length} similar symbols across the dataset.`);
    } catch (error) {
      console.error("Error finding similar:", error);
      alert("Error finding similar groups: " + error.message);
    } finally {
      setIsFindingSimilar(false);
    }
  };

  // Apply Group Class Change
  const applyGroupClass = () => {
    if (!groupingMatches || groupingTargetClass === null) return;

    if (!window.confirm(`Update ${groupingMatches.length} annotations to class "${classes[groupingTargetClass]}"?`)) {
      return;
    }

    const newImages = [...images];
    let updateCount = 0;

    // We need to group matches by imageIndex for efficient updates
    const matchesByImage = {};
    groupingMatches.forEach(m => {
      if (!matchesByImage[m.imageIndex]) matchesByImage[m.imageIndex] = [];
      matchesByImage[m.imageIndex].push(m.annotationId);
    });

    Object.keys(matchesByImage).forEach(imgIdx => {
      const idx = parseInt(imgIdx);
      const matchIds = matchesByImage[imgIdx];
      const img = newImages[idx];

      const updatedAnns = img.annotations.map(ann => {
        if (matchIds.includes(ann.id)) {
          updateCount++;
          return { ...ann, classId: groupingTargetClass };
        }
        return ann;
      });

      newImages[idx] = { ...img, annotations: updatedAnns };

      // Update modifiedImages cache
      const imageKey = `${datasetSplit}/${img.name}`;
      if (!modifiedImages[datasetSplit]) modifiedImages[datasetSplit] = {}; // Should check state correctly but we are inside function
      // Actually we should construct new modifiedImages object
    });

    // Update modifiedImages properly
    const nextModifiedImages = { ...modifiedImages };
    if (!nextModifiedImages[datasetSplit]) nextModifiedImages[datasetSplit] = {};

    Object.keys(matchesByImage).forEach(imgIdx => {
      const idx = parseInt(imgIdx);
      const img = newImages[idx];
      const imageKey = `${datasetSplit}/${img.name}`;
      nextModifiedImages[datasetSplit][imageKey] = img.annotations;
    });

    setImages(newImages);
    setModifiedImages(nextModifiedImages);

    // Update current annotations if affected
    if (newImages[currentImageIndex]) {
      setAnnotations(newImages[currentImageIndex].annotations);
    }

    // Reset selection if class changed for currently selected item?
    // Maybe just keep it.

    alert(`Successfully updated ${updateCount} annotations!`);
    setGroupingMatches(null); // Close panel
  };

  // Cancel Grouping
  const cancelGrouping = () => {
    setGroupingMatches(null);
  };

  /**
   * Generates a Zip Blob containing the YOLO dataset
   * Reused by both standard download and auto-save sync
   */
  const generateDatasetBlob = async () => {
    if (!dataset) {
      throw new Error("No dataset loaded");
    }

    // Create a new JSZip instance
    const zip = new JSZip();

    // Add dataset.yaml with preserved structure
    let datasetConfigToSave;

    if (datasetConfig && Object.keys(datasetConfig).length > 0) {
      // Use existing config and update it
      datasetConfigToSave = { ...datasetConfig };
      datasetConfigToSave.names = classes;
      datasetConfigToSave.nc = classes.length;
    } else {
      // Create new config for manually created dataset
      datasetConfigToSave = {
        path: './',
        train: 'train/images',
        val: 'valid/images',
        test: 'test/images',
        nc: classes.length,
        names: classes
      };
    }

    const yamlContent = yaml.dump(datasetConfigToSave);
    zip.file("dataset.yaml", yamlContent);

    // Create folders for each split
    const splitFolders = {};
    availableSplits.forEach(split => {
      splitFolders[split] = zip.folder(split);
      splitFolders[split].folder("images");
      splitFolders[split].folder("labels");
    });

    // Check if we're working with a manually created dataset (not from a ZIP file)
    const isManualDataset = !(dataset instanceof File) && !(dataset instanceof Blob);

    if (isManualDataset) {
      // Handle manually added images
      for (const [index, image] of images.entries()) {
        const imageKey = `${datasetSplit}/${image.name}`;
        if (deletedImages.includes(imageKey)) continue;

        const base64Data = image.src.split(',')[1];
        if (base64Data) {
          let currentImageSrc = image.src;
          const currentPatches = image.patches || [];

          if (modifiedPatches[datasetSplit] && modifiedPatches[datasetSplit][imageKey]) {
            const splitPatches = modifiedPatches[datasetSplit][imageKey];
            if (splitPatches.length > 0) {
              currentImageSrc = await bakePatchesIntoImage(image.src, splitPatches);
            }
          } else if (currentPatches.length > 0) {
            currentImageSrc = await bakePatchesIntoImage(image.src, currentPatches);
          }

          const bakedBase64Data = currentImageSrc.split(',')[1];
          const binaryString = atob(bakedBase64Data);
          const bytes = new Uint8Array(binaryString.length);

          for (let j = 0; j < binaryString.length; j++) {
            bytes[j] = binaryString.charCodeAt(j);
          }

          splitFolders[datasetSplit].folder("images").file(image.name, bytes);

          let imageAnnotations = image.annotations || [];
          if (modifiedImages[datasetSplit] && modifiedImages[datasetSplit][imageKey]) {
            imageAnnotations = modifiedImages[datasetSplit][imageKey];
          }

          let annotationContent = "";
          imageAnnotations.forEach(annotation => {
            annotationContent += `${annotation.classId} ${annotation.centerX} ${annotation.centerY} ${annotation.width} ${annotation.height}\n`;
          });

          const labelFileName = image.name.replace(/\.[^/.]+$/, ".txt");
          splitFolders[datasetSplit].folder("labels").file(labelFileName, annotationContent);
        }
      }
    } else {
      // Process each split (original ZIP file approach)
      for (const split of availableSplits) {
        const zipContent = await JSZip.loadAsync(dataset);
        let imageFolder;
        if (split === 'train') {
          imageFolder = zipContent.folder(datasetConfig?.train?.replace('/images', '') || "train/images") || zipContent.folder("train/images") || zipContent.folder("images");
        } else if (split === 'valid') {
          imageFolder = zipContent.folder(datasetConfig?.val?.replace('/images', '') || "valid/images") || zipContent.folder("valid/images") || zipContent.folder("images");
        } else if (split === 'test') {
          imageFolder = zipContent.folder(datasetConfig?.test?.replace('/images', '') || "test/images") || zipContent.folder("test/images") || zipContent.folder("images");
        } else {
          imageFolder = zipContent.folder("train/images") || zipContent.folder("images");
        }

        if (imageFolder) {
          const imageList = imageFolder.file(/.*\.(jpg|jpeg|png)$/i);

          for (let i = 0; i < imageList.length; i++) {
            const imageFile = imageList[i];
            const imageName = imageFile.name.split("/").pop();
            const imageKey = `${split}/${imageName}`;

            if (deletedImages.includes(imageKey)) continue;

            const imageData = await imageFile.async("base64");

            let currentPatches = [];
            if (modifiedPatches[split] && modifiedPatches[split][imageKey]) {
              currentPatches = modifiedPatches[split][imageKey];
            }

            if (currentPatches.length > 0) {
              const bakedSrc = await bakePatchesIntoImage(`data:image/jpeg;base64,${imageData}`, currentPatches);
              const base64Data = bakedSrc.split(',')[1];
              const binaryString = atob(base64Data);
              const bytes = new Uint8Array(binaryString.length);
              for (let j = 0; j < binaryString.length; j++) {
                bytes[j] = binaryString.charCodeAt(j);
              }
              splitFolders[split].folder("images").file(imageName, bytes);
            } else {
              const binaryString = atob(imageData);
              const bytes = new Uint8Array(binaryString.length);
              for (let j = 0; j < binaryString.length; j++) {
                bytes[j] = binaryString.charCodeAt(j);
              }
              splitFolders[split].folder("images").file(imageName, bytes);
            }

            let imageAnnotations = [];
            if (modifiedImages[split] && modifiedImages[split][imageKey]) {
              imageAnnotations = modifiedImages[split][imageKey];
            } else {
              let labelFolder;
              if (split === 'train') {
                labelFolder = zipContent.folder(datasetConfig?.train?.replace('/images', '/labels') || "train/labels") || zipContent.folder("train/labels") || zipContent.folder("labels");
              } else if (split === 'valid') {
                labelFolder = zipContent.folder(datasetConfig?.val?.replace('/images', '/labels') || "valid/labels") || zipContent.folder("valid/labels") || zipContent.folder("labels");
              } else if (split === 'test') {
                labelFolder = zipContent.folder(datasetConfig?.test?.replace('/images', '/labels') || "test/labels") || zipContent.folder("test/labels") || zipContent.folder("labels");
              } else {
                labelFolder = zipContent.folder("train/labels") || zipContent.folder("labels");
              }

              const labelFileName = imageName.replace(/\.[^/.]+$/, ".txt");
              const labelFile = labelFolder?.file(labelFileName);

              if (labelFile) {
                const labelContent = await labelFile.async("text");
                const originalAnnotations = parseAnnotations(labelContent);

                const originalNames = datasetConfig?.names || [];
                const classMapping = {};
                if (originalNames.length > 0) {
                  originalNames.forEach((name, oldIdx) => {
                    const newIdx = classes.indexOf(name);
                    classMapping[oldIdx] = newIdx;
                  });
                }

                imageAnnotations = originalAnnotations.map(ann => {
                  const newClassId = classMapping[ann.classId];
                  if (newClassId !== undefined && newClassId !== -1) {
                    return { ...ann, classId: newClassId };
                  } else if (newClassId === -1) {
                    return null;
                  }
                  return ann;
                }).filter(Boolean);
              }
            }

            let annotationContent = "";
            imageAnnotations.forEach(annotation => {
              annotationContent += `${annotation.classId} ${annotation.centerX} ${annotation.centerY} ${annotation.width} ${annotation.height}\n`;
            });

            const labelFileName = imageName.replace(/\.[^/.]+$/, ".txt");
            splitFolders[split].folder("labels").file(labelFileName, annotationContent);
          }
        }
      }
    }

    // Generate and return the zip blob
    return await zip.generateAsync({ type: "blob" });
  };

  // Sync to Backend Auto-Save Endpoint
  const handleSyncToLocalFolder = async () => {
    if (!autoSyncDirectory) {
      alert("Please enter a valid Auto-Save Directory.");
      return;
    }

    setIsSyncing(true);
    try {
      const blob = await generateDatasetBlob();

      const formData = new FormData();
      formData.append("file", blob, "dataset.zip");
      formData.append("directory", autoSyncDirectory);

      const response = await fetch("http://localhost:8000/autosave", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to sync to target directory");
      }

      setLastSyncTime(new Date());
    } catch (error) {
      console.error("Auto-sync error:", error);
      alert("Error during auto-sync: " + error.message);
      setIsAutoSyncEnabled(false); // Disable auto-sync if it fails
    } finally {
      setIsSyncing(false);
    }
  };

  // Load dataset from Local Folder
  const handleLoadFromLocalFolder = async () => {
    if (!autoSyncDirectory) {
      alert("Please enter a valid Auto-Save Directory to load from.");
      return;
    }

    setIsSyncing(true); // Reusing syncing state indicator
    try {
      const formData = new FormData();
      formData.append("directory", autoSyncDirectory);

      const response = await fetch("http://localhost:8000/load_dataset", {
        method: "POST",
        body: formData,
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || "Failed to load from target directory");
      }

      // Convert response to a blob
      const blob = await response.blob();

      // Pass a "name" property mimicking a File object so JSZip logic handles it
      blob.name = "loaded_dataset.zip";

      // Route the blob through onDrop to trigger the full JSZip parsing logic
      await onDrop([blob]);

    } catch (error) {
      console.error("Load dataset error:", error);
      alert("Error loading dataset: " + error.message);
    } finally {
      setIsSyncing(false);
    }
  };

  // Auto-Sync Effect Hook (runs every 30 seconds if enabled)
  useEffect(() => {
    let interval;
    if (isAutoSyncEnabled && autoSyncDirectory && dataset) {
      interval = setInterval(() => {
        // Trigger auto-sync silently
        handleSyncToLocalFolder().catch(err => {
          console.error("Silent auto-sync failed:", err);
          setIsAutoSyncEnabled(false);
        });
      }, 30000); // 30 seconds
    }
    return () => clearInterval(interval);
  }, [isAutoSyncEnabled, autoSyncDirectory, dataset, images, classes, deletedImages, modifiedImages, modifiedPatches]);

  // Download modified dataset in YOLO format
  const downloadDataset = async () => {
    if (!dataset) {
      alert("Please load a dataset first!");
      return;
    }

    try {
      const content = await generateDatasetBlob();

      // Create download link
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = customFilename ? `${customFilename}.zip` : "edited_dataset_yolo.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert("Dataset downloaded successfully in YOLO format!");
    } catch (error) {
      console.error("Error downloading dataset:", error);
      alert("Error downloading dataset. Please try again.");
    }
  };

  // Download modified dataset in COCO format
  const downloadDatasetCOCO = async () => {
    if (!dataset) {
      alert("Please load a dataset first!");
      return;
    }

    try {
      // Create a new JSZip instance
      const zip = new JSZip();

      // Create COCO format structure
      const cocoDataset = {
        info: {
          year: new Date().getFullYear(),
          version: "1.0",
          description: "Exported from YOLO File Review Dataset Editor",
          contributor: "YOLO File Review Dataset Editor",
          url: "",
          date_created: new Date().toISOString()
        },
        licenses: [{
          id: 1,
          name: "Unknown",
          url: ""
        }],
        images: [],
        annotations: [],
        categories: classes.map((name, id) => ({
          id: id,
          name: name,
          supercategory: "object"
        }))
      };

      // Keep track of image and annotation IDs
      let imageIdCounter = 1;
      let annotationIdCounter = 1;

      // Process each split
      for (const split of availableSplits) {
        // Create folders for this split
        const splitFolder = zip.folder(split);
        const imagesFolder = splitFolder.folder("images");

        // Get the images for this split
        let splitImages = [];

        // If we're working with a manually created dataset
        if (!dataset.name || typeof dataset.name !== 'string') {
          splitImages = images.filter(img => !deletedImages.includes(`${datasetSplit}/${img.name}`));
        } else {
          // Load from original ZIP file
          const zipContent = await JSZip.loadAsync(dataset);
          let imageFolder;
          if (split === 'train') {
            imageFolder = zipContent.folder(datasetConfig?.train?.replace('/images', '') || "train/images") || zipContent.folder("train/images") || zipContent.folder("images");
          } else if (split === 'valid') {
            imageFolder = zipContent.folder(datasetConfig?.val?.replace('/images', '') || "valid/images") || zipContent.folder("valid/images") || zipContent.folder("images");
          } else if (split === 'test') {
            imageFolder = zipContent.folder(datasetConfig?.test?.replace('/images', '') || "test/images") || zipContent.folder("test/images") || zipContent.folder("images");
          } else {
            imageFolder = zipContent.folder("train/images") || zipContent.folder("images");
          }

          if (imageFolder) {
            const imageList = imageFolder.file(/.*\.(jpg|jpeg|png)$/i);

            for (let i = 0; i < imageList.length; i++) {
              const imageFile = imageList[i];
              const imageName = imageFile.name.split("/").pop();

              // Check if image is deleted
              const imageKey = `${split}/${imageName}`;
              if (deletedImages.includes(imageKey)) continue;

              // Extract the original image data (base64)
              const imageData = await imageFile.async("base64");
              const binaryString = atob(imageData);
              const bytes = new Uint8Array(binaryString.length);

              for (let j = 0; j < binaryString.length; j++) {
                bytes[j] = binaryString.charCodeAt(j);
              }

              // Add image to zip
              imagesFolder.file(imageName, bytes);

              // Get annotations - either modified or original
              let imageAnnotations = [];
              // imageKey already defined above
              if (modifiedImages[split] && modifiedImages[split][imageKey]) {
                // Use modified annotations
                imageAnnotations = modifiedImages[split][imageKey];
              } else {
                // Load original annotations if available
                let labelFolder;
                if (split === 'train') {
                  labelFolder = zipContent.folder(datasetConfig?.train?.replace('/images', '/labels') || "train/labels") || zipContent.folder("train/labels") || zipContent.folder("labels");
                } else if (split === 'valid') {
                  labelFolder = zipContent.folder(datasetConfig?.val?.replace('/images', '/labels') || "valid/labels") || zipContent.folder("valid/labels") || zipContent.folder("labels");
                } else if (split === 'test') {
                  labelFolder = zipContent.folder(datasetConfig?.test?.replace('/images', '/labels') || "test/labels") || zipContent.folder("test/labels") || zipContent.folder("labels");
                } else {
                  labelFolder = zipContent.folder("train/labels") || zipContent.folder("labels");
                }

                const labelFileName = imageName.replace(/\.[^/.]+$/, ".txt");
                const labelFile = labelFolder?.file(labelFileName);

                if (labelFile) {
                  const labelContent = await labelFile.async("text");
                  imageAnnotations = parseAnnotations(labelContent);
                }
              }

              // Add to our split images array
              splitImages.push({
                id: i,
                name: imageName,
                src: `data:image/jpeg;base64,${imageData}`,
                annotations: imageAnnotations
              });
            }
          }
        }

        // Process images for COCO format
        for (const image of splitImages) {
          // Create a temporary image element to get dimensions
          const imgElement = new Image();
          imgElement.src = image.src;

          // Wait for image to load to get dimensions
          await new Promise((resolve) => {
            imgElement.onload = () => resolve();
          });

          const width = imgElement.width;
          const height = imgElement.height;

          // Add image info to COCO dataset
          const cocoImage = {
            id: imageIdCounter,
            width: width,
            height: height,
            file_name: image.name,
            license: 1,
            flickr_url: "",
            coco_url: "",
            date_captured: new Date().toISOString()
          };

          cocoDataset.images.push(cocoImage);

          // Add annotations to COCO dataset
          if (image.annotations) {
            image.annotations.forEach(annotation => {
              // Convert YOLO format to COCO format
              const bboxWidth = annotation.width * width;
              const bboxHeight = annotation.height * height;
              const bboxX = (annotation.centerX * width) - (bboxWidth / 2);
              const bboxY = (annotation.centerY * height) - (bboxHeight / 2);

              const cocoAnnotation = {
                id: annotationIdCounter,
                image_id: imageIdCounter,
                category_id: annotation.classId,
                bbox: [bboxX, bboxY, bboxWidth, bboxHeight],
                area: bboxWidth * bboxHeight,
                segmentation: [], // Empty segmentation for bounding boxes
                iscrowd: 0
              };

              cocoDataset.annotations.push(cocoAnnotation);
              annotationIdCounter++;
            });
          }

          imageIdCounter++;

          // If we're working with a manually created dataset, add image to zip
          if (!dataset.name || typeof dataset.name !== 'string') {
            const base64Data = image.src.split(',')[1];
            if (base64Data) {
              const binaryString = atob(base64Data);
              const bytes = new Uint8Array(binaryString.length);

              for (let j = 0; j < binaryString.length; j++) {
                bytes[j] = binaryString.charCodeAt(j);
              }

              imagesFolder.file(image.name, bytes);
            }
          }
        }
      }

      // Add COCO annotations JSON file
      zip.file("annotations.json", JSON.stringify(cocoDataset, null, 2));

      // Generate the zip file
      const content = await zip.generateAsync({ type: "blob" });

      // Create download link
      const url = URL.createObjectURL(content);
      const link = document.createElement("a");
      link.href = url;
      link.download = customFilename ? `${customFilename}.zip` : "edited_dataset_coco.zip";
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      alert("Dataset downloaded successfully in COCO format!");
    } catch (error) {
      console.error("Error downloading dataset in COCO format:", error);
      alert("Error downloading dataset in COCO format. Please try again.");
    }
  };

  // Function to add a new class
  const addNewClass = () => {
    if (!newClassName.trim()) {
      alert('Please enter a class name');
      return;
    }

    // Check if class already exists
    if (classes.includes(newClassName.trim())) {
      alert('Class already exists');
      return;
    }

    // Add new class
    const updatedClasses = [...classes, newClassName.trim()];
    setClasses(updatedClasses);
    setNewClassName(''); // Clear input

    alert(`Class "${newClassName.trim()}" added successfully!`);
  };

  // Function to apply global padding to all annotations of a specific class
  const applyGlobalPadding = (classId, widthPadding, heightPadding) => {
    // Update the class padding settings
    setClassPadding(prev => ({
      ...prev,
      [classId]: { width: widthPadding, height: heightPadding }
    }));

    // Apply padding to all annotations of this class across all images
    const updatedImages = images.map(image => {
      const updatedAnnotations = image.annotations.map(annotation => {
        if (annotation.classId === classId) {
          // Apply padding to width and height
          const newWidth = Math.min(1, Math.max(0, annotation.width + widthPadding));
          const newHeight = Math.min(1, Math.max(0, annotation.height + heightPadding));

          return {
            ...annotation,
            width: newWidth,
            height: newHeight
          };
        }
        return annotation;
      });

      return {
        ...image,
        annotations: updatedAnnotations
      };
    });

    setImages(updatedImages);

    // Update current annotations if we're on the current image
    if (currentImageIndex < updatedImages.length) {
      setAnnotations(updatedImages[currentImageIndex].annotations);
    }

    // Update modifiedImages state
    const updatedModifiedImages = { ...modifiedImages };
    updatedImages.forEach(image => {
      const imageKey = `${datasetSplit}/${image.name}`;
      if (!updatedModifiedImages[datasetSplit]) {
        updatedModifiedImages[datasetSplit] = {};
      }
      updatedModifiedImages[datasetSplit][imageKey] = image.annotations;
    });
    setModifiedImages(updatedModifiedImages);

    alert(`Global padding applied to all "${classes[classId]}" annotations!`);
  };

  // Function to reset padding for a class
  const resetClassPadding = (classId) => {
    setClassPadding(prev => {
      const updated = { ...prev };
      delete updated[classId];
      return updated;
    });

    alert(`Padding reset for "${classes[classId]}" annotations!`);
  };

  // Function to handle class renaming
  const handleClassRename = (updatedImages, updatedClasses) => {
    // Update images
    setImages(updatedImages);

    // Persist class changes for downloads by updating modifiedImages cache
    setModifiedImages(prev => {
      const next = { ...prev };
      const splitKey = datasetSplit;
      const splitImages = next[splitKey] ? { ...next[splitKey] } : {};

      updatedImages.forEach(image => {
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
      setSelectedClass(updatedClasses[0] || '');
    }
  };

  return (
    <div className="app">
      {currentView === 'editor' ? (
        <>
          <div className="header">
            <h1>🎨 Advanced Dataset Editor</h1>
            <div className="header-controls">
              {/* Tool Buttons */}
              <div className="tool-buttons">
                <button
                  className={`tool-button ${tool === 'select' ? 'active' : ''}`}
                  onClick={() => setTool('select')}
                  title="Select Tool (Ctrl/Cmd+S)"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
                    <path d="M13 13l6 6" />
                  </svg>
                </button>
                <button
                  className={`tool-button ${tool === 'rectangle' ? 'active' : ''}`}
                  onClick={() => setTool('rectangle')}
                  title="Rectangle Tool (Ctrl/Cmd+R)"
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
                  </svg>
                </button>
                <button
                  className={`tool-button ${tool === 'patch' ? 'active' : ''}`}
                  onClick={() => setTool('patch')}
                  title="Patch Tool. Draw patches to cover unwanted areas (Ctrl/Cmd+E or Shift+R)."
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                    <polyline points="14 2 14 8 20 8" />
                    <path d="M8 13h8" />
                    <path d="M8 17h8" />
                    <path d="M8 9h2" />
                  </svg>
                </button>
                <button
                  className="tool-button"
                  onClick={handleUndoPatch}
                  title="Undo Last Patch (Ctrl+Z)"
                  style={{ marginLeft: '5px' }}
                >
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 7v6h6" />
                    <path d="M21 17a9 9 0 0 0-9-9 9 9 0 0 0-6 2.3L3 13" />
                  </svg>
                </button>
              </div>

              <div className="header-actions">
                {dataset && (
                  <>
                    <button className="tool-button" onClick={() => setCurrentView('dashboard')} style={{ width: 'auto', padding: '0 10px', marginRight: '5px' }} title="Dashboard">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <line x1="18" y1="20" x2="18" y2="10" />
                        <line x1="12" y1="20" x2="12" y2="4" />
                        <line x1="6" y1="20" x2="6" y2="14" />
                      </svg>
                      <span style={{ fontSize: '0.75rem', marginLeft: '6px', fontWeight: '500' }}>Dashboard</span>
                    </button>
                    <button className="tool-button" onClick={() => setCurrentView('merge')} style={{ width: 'auto', padding: '0 10px', marginRight: '5px' }} title="Merge Datasets">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <circle cx="18" cy="18" r="3" />
                        <circle cx="6" cy="6" r="3" />
                        <path d="M13 6h3a2 2 0 0 1 2 2v7" />
                        <line x1="6" y1="9" x2="6" y2="21" />
                      </svg>
                      <span style={{ fontSize: '0.75rem', marginLeft: '6px', fontWeight: '500' }}>Merge</span>
                    </button>
                    <button className="tool-button" onClick={() => setCurrentView('monitor')} style={{ width: 'auto', padding: '0 10px', marginRight: '5px' }} title="Dataset Monitor">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
                      </svg>
                      <span style={{ fontSize: '0.75rem', marginLeft: '6px', fontWeight: '500' }}>Monitor</span>
                    </button>
                  </>
                )}
                <button className="tool-button" onClick={saveAnnotations} style={{ width: 'auto', padding: '0 10px', marginRight: '5px' }} title="Save Annotations">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z" />
                    <polyline points="17 21 17 13 7 13 7 21" />
                    <polyline points="7 3 7 8 15 8" />
                  </svg>
                  <span style={{ fontSize: '0.75rem', marginLeft: '6px', fontWeight: '500' }}>Save</span>
                </button>
                {dataset && (
                  <>
                    <div style={{ display: 'inline-flex', alignItems: 'center', backgroundColor: '#e8f4f8', padding: '5px 10px', borderRadius: '5px', marginLeft: '10px' }}>
                      <button
                        className="button"
                        onClick={handleSyncToLocalFolder}
                        disabled={isSyncing}
                        style={{ backgroundColor: '#3498db', padding: '5px 10px' }}
                      >
                        {isSyncing ? '🔄 Syncing...' : '💾 Sync Now'}
                      </button>
                      <label style={{ marginLeft: '10px', fontSize: '0.9rem', display: 'flex', alignItems: 'center', cursor: 'pointer', color: '#333' }}>
                        <input
                          type="checkbox"
                          checked={isAutoSyncEnabled}
                          onChange={(e) => setIsAutoSyncEnabled(e.target.checked)}
                          style={{ marginRight: '5px' }}
                        />
                        Auto-Sync (30s)
                      </label>
                    </div>
                    <button className="tool-button" onClick={downloadDataset} style={{ width: 'auto', padding: '0 10px', marginLeft: '10px' }} title="Download YOLO">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      <span style={{ fontSize: '0.75rem', marginLeft: '6px', fontWeight: '500' }}>YOLO</span>
                    </button>
                    <button className="tool-button" onClick={downloadDatasetCOCO} style={{ width: 'auto', padding: '0 10px', marginLeft: '5px' }} title="Download COCO">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="7 10 12 15 17 10" />
                        <line x1="12" y1="15" x2="12" y2="3" />
                      </svg>
                      <span style={{ fontSize: '0.75rem', marginLeft: '6px', fontWeight: '500' }}>COCO</span>
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="main-content">
            {/* Sidebar */}
            <div className="sidebar">
              <h2>📁 Dataset</h2>

              {!dataset ? (
                <div className="dataset-start-options">
                  <h3 style={{ marginBottom: '1.5rem', color: '#2c3e50' }}>Choose How to Start</h3>

                  {/* Option 1: Load Existing Dataset */}
                  <div className="start-option-card">
                    <h4>📦 Load Existing YOLO Dataset</h4>
                    <p>Upload a ZIP file containing images and annotations in YOLO format</p>
                    <div {...getRootProps()} className="dropzone" style={{ marginTop: '1rem' }}>
                      <input {...getInputProps()} />
                      {isDragActive ? (
                        <p>Drop the dataset ZIP file here ...</p>
                      ) : (
                        <p>Drag 'n' drop a dataset ZIP file here, or click to select</p>
                      )}
                    </div>

                    {/* Dataset Split Selection */}
                    <div className="form-group" style={{ marginTop: '15px' }}>
                      <label>Dataset Split:</label>
                      <select
                        value={datasetSplit}
                        onChange={(e) => setDatasetSplit(e.target.value)}
                      >
                        {availableSplits.map((split) => (
                          <option key={split} value={split}>
                            {split.charAt(0).toUpperCase() + split.slice(1)}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Option 2: Load from Auto-Save Directory */}
                  <div className="start-option-card">
                    <h4>📂 Load from Auto-Save Local Directory</h4>
                    <p>Load your previously synced YOLO dataset directly from your computer</p>
                    <div className="form-group" style={{ marginTop: '1rem' }}>
                      <label>Local Directory Path:</label>
                      <input
                        type="text"
                        placeholder="e.g., C:\Datasets\MyProject"
                        value={autoSyncDirectory}
                        onChange={(e) => setAutoSyncDirectory(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem' }}
                      />
                      <button
                        className="button"
                        onClick={handleLoadFromLocalFolder}
                        disabled={isSyncing}
                        style={{ width: '100%', backgroundColor: '#3498db' }}
                      >
                        {isSyncing ? '🔄 Loading...' : '📥 Load Dataset'}
                      </button>
                    </div>
                  </div>

                  {/* Option 3: Start from Scratch */}
                  <div className="start-option-card">
                    <h4>🎨 Start from Scratch</h4>
                    <p>Upload raw images and create annotations from scratch</p>

                    {/* Class Definition */}
                    <div className="form-group" style={{ marginTop: '1rem' }}>
                      <label>Define Your Classes (comma-separated):</label>
                      <input
                        type="text"
                        placeholder="e.g., person, car, dog"
                        value={newClassName}
                        onChange={(e) => setNewClassName(e.target.value)}
                        style={{ width: '100%', padding: '0.5rem', marginBottom: '0.5rem' }}
                      />
                      <p style={{ fontSize: '0.8rem', color: '#7f8c8d', marginTop: '0.25rem' }}>
                        Enter class names separated by commas
                      </p>
                    </div>

                    {/* Image Upload */}
                    <div
                      {...getRootProps()}
                      className="dropzone"
                      style={{ marginTop: '1rem' }}
                    >
                      <input {...getInputProps()} />
                      {isDragActive ? (
                        <p>Drop images here ...</p>
                      ) : (
                        <p>Drag 'n' drop images here, or click to select</p>
                      )}
                      <p style={{ fontSize: '0.8rem', marginTop: '5px' }}>
                        (Supports JPG, PNG, GIF formats)
                      </p>
                    </div>

                    <button
                      className="button"
                      onClick={() => {
                        if (newClassName.trim()) {
                          const classNames = newClassName.split(',').map(c => c.trim()).filter(c => c);
                          if (classNames.length > 0) {
                            setClasses(classNames);
                            setSelectedClass(classNames[0]);
                            alert(`Classes set: ${classNames.join(', ')}\n\nNow upload your images to start annotating!`);
                          }
                        } else {
                          alert('Please enter at least one class name');
                        }
                      }}
                      style={{ width: '100%', marginTop: '1rem' }}
                    >
                      Set Classes & Start Annotating
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  {/* Manual Image Upload Section */}
                  <div className="form-group">
                    <label>➕ Add Images to Current Split ({datasetSplit}):</label>
                    <div
                      {...getRootProps()}
                      className="dropzone"
                      style={{ padding: '1rem', marginBottom: '1rem' }}
                    >
                      <input {...getInputProps()} />
                      {isDragActive ? (
                        <p>Drop images here ...</p>
                      ) : (
                        <p>Drag 'n' drop images here, or click to select files</p>
                      )}
                      <p style={{ fontSize: '0.8rem', marginTop: '5px' }}>
                        (Add individual images to the {datasetSplit} split)
                      </p>
                    </div>
                    <button
                      className="button"
                      onClick={() => fileInputRef.current && fileInputRef.current.click()}
                      style={{ width: '100%', marginBottom: '1rem' }}
                    >
                      📁 Select Images
                    </button>
                  </div>

                  {/* Custom Filename Input */}
                  <div className="form-group">
                    <label>Download Filename (Optional):</label>
                    <input
                      type="text"
                      placeholder="e.g., my_dataset"
                      value={customFilename}
                      onChange={(e) => setCustomFilename(e.target.value)}
                      style={{ width: '100%', marginBottom: '5px' }}
                    />
                    <p style={{ fontSize: '0.8rem', color: '#7f8c8d', marginBottom: '10px' }}>
                      Will be downloaded as {customFilename || 'edited_dataset_[format]'}.zip
                    </p>
                  </div>

                  {/* Auto-Save Directory Settings */}
                  <div className="form-group">
                    <label>Auto-Save Local Directory:</label>
                    <input
                      type="text"
                      placeholder="e.g., C:\Datasets\MyProject"
                      value={autoSyncDirectory}
                      onChange={(e) => setAutoSyncDirectory(e.target.value)}
                      title="Used by the 'Sync Now' and 'Auto-Sync' features"
                      style={{ width: '100%', marginBottom: '5px', borderColor: isAutoSyncEnabled ? '#3498db' : '#ccc' }}
                    />
                    <p style={{ fontSize: '0.8rem', color: '#7f8c8d', marginBottom: '10px' }}>
                      Paths are processed by your local backend. Extracts YOLO dataset directly to this folder.
                      {lastSyncTime && <span style={{ display: 'block', color: '#27ae60', marginTop: '2px' }}>Last synced: {lastSyncTime.toLocaleTimeString()}</span>}
                    </p>
                  </div>

                  {/* Dataset Split Selection */}
                  <div className="form-group">
                    <label>Dataset Split:</label>
                    <select
                      value={datasetSplit}
                      onChange={(e) => handleDatasetSplitChange(e.target.value)}
                    >
                      {availableSplits.map((split) => (
                        <option key={split} value={split}>
                          {split.charAt(0).toUpperCase() + split.slice(1)}
                        </option>
                      ))}
                    </select>
                    <p style={{ fontSize: '0.8rem', color: '#7f8c8d', marginTop: '5px' }}>
                      Loaded {images.length} images from {datasetSplit} set
                    </p>
                  </div>

                  <div className="form-group">
                    <label>Selected Class:</label>
                    <select
                      value={selectedClass}
                      onChange={(e) => setSelectedClass(e.target.value)}
                    >
                      {classes.map((cls, index) => (
                        <option key={index} value={cls}>{cls}</option>
                      ))}
                    </select>
                  </div>

                  {/* Global Padding Controls */}
                  <div className="form-group">
                    <label>Global Padding for "{selectedClass}":</label>
                    <div style={{ display: 'flex', gap: '10px', marginBottom: '10px' }}>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '2px' }}>Width</label>
                        <input
                          type="number"
                          step="0.01"
                          min="-1"
                          max="1"
                          value={classPadding[classes.indexOf(selectedClass)]?.width || 0}
                          onChange={(e) => {
                            const classId = classes.indexOf(selectedClass);
                            const widthPadding = parseFloat(e.target.value) || 0;
                            setClassPadding(prev => ({
                              ...prev,
                              [classId]: {
                                ...(prev[classId] || { height: 0 }),
                                width: widthPadding
                              }
                            }));
                          }}
                          style={{ width: '100%' }}
                        />
                      </div>
                      <div style={{ flex: 1 }}>
                        <label style={{ display: 'block', fontSize: '0.8rem', marginBottom: '2px' }}>Height</label>
                        <input
                          type="number"
                          step="0.01"
                          min="-1"
                          max="1"
                          value={classPadding[classes.indexOf(selectedClass)]?.height || 0}
                          onChange={(e) => {
                            const classId = classes.indexOf(selectedClass);
                            const heightPadding = parseFloat(e.target.value) || 0;
                            setClassPadding(prev => ({
                              ...prev,
                              [classId]: {
                                ...(prev[classId] || { width: 0 }),
                                height: heightPadding
                              }
                            }));
                          }}
                          style={{ width: '100%' }}
                        />
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <button
                        className="button"
                        onClick={() => {
                          const classId = classes.indexOf(selectedClass);
                          const widthPadding = classPadding[classId]?.width || 0;
                          const heightPadding = classPadding[classId]?.height || 0;
                          applyGlobalPadding(classId, widthPadding, heightPadding);
                        }}
                        style={{ flex: 1 }}
                      >
                        Apply to All
                      </button>
                      <button
                        className="button"
                        onClick={() => resetClassPadding(classes.indexOf(selectedClass))}
                        style={{ backgroundColor: '#e74c3c', flex: 1 }}
                      >
                        Reset
                      </button>
                    </div>
                    <p style={{ fontSize: '0.75rem', color: '#7f8c8d', marginTop: '5px' }}>
                      Values between -1 and 1. Positive values increase size, negative values decrease.
                    </p>
                  </div>

                  {/* Add New Class */}
                  <div className="form-group">
                    <label>Add New Class:</label>
                    <div style={{ display: 'flex', gap: '5px' }}>
                      <input
                        type="text"
                        value={newClassName}
                        onChange={(e) => setNewClassName(e.target.value)}
                        placeholder="Enter new class name"
                        style={{ flex: 1 }}
                      />
                      <button
                        className="button"
                        onClick={addNewClass}
                        style={{ padding: '0.5rem', minWidth: '60px' }}
                      >
                        Add
                      </button>
                    </div>
                  </div>

                  {/* YOLO Auto-Annotation */}
                  <div className="form-group" style={{ marginTop: '20px', padding: '15px', backgroundColor: '#1a436cff', borderRadius: '8px', border: '1px solid #dee2e6' }}>
                    <h3 style={{ marginBottom: '10px', fontSize: '1rem' }}>🤖 YOLO Auto-Annotation</h3>
                    <p style={{ fontSize: '0.8rem', color: '#ffffffff', marginBottom: '10px' }}>
                      Automatically detect symbols using your trained YOLO model.
                    </p>
                    <button
                      className="button"
                      onClick={handleAutoAnnotate}
                      disabled={isAutoAnnotating || !currentImage}
                      style={{
                        width: '100%',
                        backgroundColor: isAutoAnnotating ? '#95a5a6' : '#2ecc71',
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        gap: '10px'
                      }}
                    >
                      {isAutoAnnotating ? (
                        <>
                          <span className="loader-small"></span>
                          Processing...
                        </>
                      ) : (
                        <>✨ Predict with YOLO</>
                      )}
                    </button>
                    <p style={{ fontSize: '0.7rem', color: '#7f8c8d', marginTop: '8px', textAlign: 'center' }}>
                      Requires backend running at localhost:8000
                    </p>
                  </div>


                  <div className="batch-navigation">
                    <h3>🖼️ Images ({images.length})</h3>
                    <div className="batch-controls">
                      <button
                        className="nav-button"
                        onClick={goToPreviousBatch}
                        disabled={batchStartIndex === 0}
                      >
                        ◀ Prev Batch
                      </button>
                      <span>
                        Batch {currentBatchIndex} of {totalBatches}
                      </span>
                      <button
                        className="nav-button"
                        onClick={goToNextBatch}
                        disabled={batchStartIndex + batchSize >= images.length}
                      >
                        Next Batch ▶
                      </button>
                    </div>
                  </div>

                  {/* Batch Navigation - existing code */}
                  <div className="batch-navigation">
                    <h3>Images ({images.length})</h3>
                    <div className="batch-controls">
                      <button className="nav-button" onClick={goToPreviousBatch} disabled={batchStartIndex === 0}>
                        Prev Batch
                      </button>
                      <span>Batch {currentBatchIndex} of {totalBatches}</span>
                      <button className="nav-button" onClick={goToNextBatch} disabled={batchStartIndex + batchSize >= images.length}>
                        Next Batch
                      </button>
                    </div>
                  </div>

                  {/* Class-wise Batch Filter */}
                  <div className="form-group" style={{ marginTop: '15px', paddingTop: '15px', borderTop: '1px solid #e0e0e0' }}>
                    <label>
                      <input
                        type="checkbox"
                        checked={isClassWiseBatch}
                        onChange={(e) => {
                          setIsClassWiseBatch(e.target.checked);
                          setBatchStartIndex(0); // Reset to first batch
                          if (e.target.checked) {
                            setClassWiseBatchClass(classes.indexOf(selectedClass));
                          }
                        }}
                      />
                      {' '}Filter batch by class
                    </label>

                    {isClassWiseBatch && (
                      <>
                        <select
                          value={classWiseBatchClass !== null ? classWiseBatchClass : classes.indexOf(selectedClass)}
                          onChange={(e) => {
                            setClassWiseBatchClass(parseInt(e.target.value));
                            setBatchStartIndex(0); // Reset to first batch when changing class
                          }}
                          style={{ marginTop: '10px', width: '100%' }}
                        >
                          {classes.map((cls, index) => {
                            const imageCount = getImagesWithClass(index).length;
                            return (
                              <option key={index} value={index}>
                                {cls} ({imageCount} images)
                              </option>
                            );
                          })}
                        </select>

                        <p style={{ fontSize: '0.8rem', color: '#7f8c8d', marginTop: '5px' }}>
                          Showing {getImagesWithClass(classWiseBatchClass).length} images with "{classes[classWiseBatchClass]}" annotations
                        </p>
                      </>
                    )}
                  </div>



                  {/* Thumbnail Grid */}
                  <div className="thumbnail-grid">
                    {currentBatch.map((image, batchIndex) => {
                      // Find the actual index in the displayImages array
                      const displayIndex = displayImages.findIndex(img => img.id === image.id);
                      // Find the actual index in the original images array
                      const actualImageIndex = images.findIndex(img => img.id === image.id);

                      return (
                        <div
                          key={image.id}
                          className={`thumbnail-item ${actualImageIndex === currentImageIndex ? 'active' : ''}`}
                          onClick={() => handleImageSelect(actualImageIndex)}
                        >
                          <div className="thumbnail-image-container">
                            <img
                              src={image.src}
                              alt={image.name}
                              className="thumbnail-image"
                            />
                          </div>
                          <div className="thumbnail-info">
                            <span className="thumbnail-name">{image.name}</span>
                            <span className="thumbnail-count">{image.annotations.length} annotations</span>
                          </div>
                        </div>
                      );
                    })}
                  </div>



                  {/* Annotation Editing Panel */}
                  {selectedAnnotations.length > 0 && (
                    <div className="annotation-edit-panel">
                      {selectedAnnotation && selectedAnnotations.length === 1 ? (
                        // Single annotation editing
                        <>
                          <h3>✏️ Edit Annotation</h3>
                          <div className="form-group">
                            <label>Class:</label>
                            <select
                              value={(editingAnnotation?.classId !== undefined && editingAnnotation?.classId !== null) ? editingAnnotation.classId : (selectedAnnotation?.classId || 0)}
                              onChange={(e) => {
                                const newClassId = parseInt(e.target.value);
                                if (selectedAnnotation) {
                                  handleAnnotationClassChange(selectedAnnotation.id, newClassId);
                                  setEditingAnnotation({ ...editingAnnotation, classId: newClassId });
                                }
                              }}
                            >
                              {classes.map((cls, index) => (
                                <option key={index} value={index}>{cls}</option>
                              ))}
                            </select>
                          </div>

                          <div className="form-group">
                            <label>Width:</label>
                            <input
                              type="number"
                              step="0.001"
                              value={(editingAnnotation?.width !== undefined && editingAnnotation?.width !== null) ? editingAnnotation.width : (selectedAnnotation?.width || 0)}
                              onChange={(e) => {
                                const newWidth = parseFloat(e.target.value);
                                if (selectedAnnotation) {
                                  handleAnnotationSizeChange(selectedAnnotation.id, newWidth, (editingAnnotation?.height !== undefined && editingAnnotation?.height !== null) ? editingAnnotation.height : (selectedAnnotation?.height || 0));
                                  setEditingAnnotation({ ...editingAnnotation, width: newWidth });
                                }
                              }}
                            />
                          </div>

                          <div className="form-group">
                            <label>Height:</label>
                            <input
                              type="number"
                              step="0.001"
                              value={(editingAnnotation?.height !== undefined && editingAnnotation?.height !== null) ? editingAnnotation.height : (selectedAnnotation?.height || 0)}
                              onChange={(e) => {
                                const newHeight = parseFloat(e.target.value);
                                if (selectedAnnotation) {
                                  handleAnnotationSizeChange(selectedAnnotation.id, (editingAnnotation?.width !== undefined && editingAnnotation?.width !== null) ? editingAnnotation.width : (selectedAnnotation?.width || 0), newHeight);
                                  setEditingAnnotation({ ...editingAnnotation, height: newHeight });
                                }
                              }}
                            />
                          </div>

                          <button
                            className="delete-btn"
                            onClick={() => selectedAnnotation && handleAnnotationDelete(selectedAnnotation.id)}
                            style={{ width: '100%', marginTop: '10px' }}
                          >
                            Delete Annotation
                          </button>
                          <button
                            className="button"
                            onClick={handleFindSimilar}
                            disabled={isFindingSimilar}
                            title="Find similar symbols across the entire dataset"
                            style={{ width: '100%', marginTop: '10px', backgroundColor: '#3498db', fontSize: '0.9rem' }}
                          >
                            {isFindingSimilar ? '🔍 Finding...' : '🔍 Find & Group Similar'}
                          </button>
                          {/* Threshold Slider */}
                          <div style={{ marginTop: '10px' }}>
                            <label style={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between' }}>
                              <span>Similarity Threshold:</span>
                              <span>{Math.round(similarityThreshold * 100)}%</span>
                            </label>
                            <input
                              type="range"
                              min="0.5"
                              max="0.99"
                              step="0.01"
                              value={similarityThreshold}
                              onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
                              style={{ width: '100%' }}
                            />
                            <p style={{ fontSize: '0.7rem', color: '#7f8c8d', marginTop: '2px' }}>
                              Higher = Stricter matching
                            </p>
                          </div>
                        </>
                      ) : selectedAnnotations.length > 1 ? (
                        // Multiple annotation info
                        <>
                          <h3>✏️ Multiple Annotations Selected</h3>
                          <p>{selectedAnnotations.length} annotations selected</p>
                          <button
                            className="delete-btn"
                            onClick={handleMultipleAnnotationDelete}
                            style={{ width: '100%', marginTop: '10px' }}
                          >
                            Delete All Selected
                          </button>
                          <button
                            className="button"
                            onClick={handleFindSimilar}
                            disabled={isFindingSimilar}
                            title="Find similar symbols across the entire dataset"
                            style={{ width: '100%', marginTop: '10px', backgroundColor: '#3498db', fontSize: '0.9rem' }}
                          >
                            {isFindingSimilar ? '🔍 Finding...' : '🔍 Find & Group Similar'}
                          </button>
                          {/* Threshold Slider */}
                          <div style={{ marginTop: '10px' }}>
                            <label style={{ fontSize: '0.8rem', display: 'flex', justifyContent: 'space-between' }}>
                              <span>Similarity Threshold:</span>
                              <span>{Math.round(similarityThreshold * 100)}%</span>
                            </label>
                            <input
                              type="range"
                              min="0.5"
                              max="0.99"
                              step="0.01"
                              value={similarityThreshold}
                              onChange={(e) => setSimilarityThreshold(parseFloat(e.target.value))}
                              style={{ width: '100%' }}
                            />
                            <p style={{ fontSize: '0.7rem', color: '#7f8c8d', marginTop: '2px' }}>
                              Higher = Stricter matching
                            </p>
                          </div>
                        </>
                      ) : null}
                    </div>
                  )}

                  {/* Smart Grouping Results Panel */}
                  {groupingMatches && (
                    <div className="annotation-edit-panel" style={{ marginTop: '10px', backgroundColor: '#4a0557ff', border: '1px solid #1abc9c' }}>
                      <h3>✨ Smart Grouping Results</h3>
                      <p>Found <strong>{groupingMatches.length}</strong> similar symbols across the dataset.</p>

                      <div className="form-group" style={{ marginTop: '10px' }}>
                        <label>Change Class To:</label>
                        <select
                          value={groupingTargetClass}
                          onChange={(e) => setGroupingTargetClass(parseInt(e.target.value))}
                          style={{ width: '100%', padding: '5px' }}
                        >
                          {classes.map((cls, index) => (
                            <option key={index} value={index}>{cls}</option>
                          ))}
                        </select>
                      </div>

                      <div style={{ display: 'flex', gap: '5px', marginTop: '10px' }}>
                        <button
                          className="button"
                          onClick={applyGroupClass}
                          style={{ flex: 1, backgroundColor: '#2ecc71', fontSize: '0.9rem' }}
                        >
                          Apply to All
                        </button>
                        <button
                          className="button"
                          onClick={cancelGrouping}
                          style={{ flex: 1, backgroundColor: '#95a5a6', fontSize: '0.9rem' }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Annotations List */}
                  {annotations.length > 0 && (
                    <div className="annotation-list">
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px' }}>
                        <h3>📝 Annotations ({annotations.length})</h3>
                        {selectedAnnotations.length > 1 && (
                          <button
                            className="delete-btn"
                            onClick={handleMultipleAnnotationDelete}
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.8rem' }}
                          >
                            Delete {selectedAnnotations.length} Selected
                          </button>
                        )}
                      </div>
                      {annotations.map((annotation) => (
                        <div
                          key={annotation.id}
                          className={`annotation-item ${selectedAnnotations.includes(annotation.id) ? 'active' : ''}`}
                          onClick={(e) => handleAnnotationSelect(annotation, e)}
                        >
                          <div className="annotation-item-header">
                            <h4>Annotation #{annotation.id}</h4>
                            <button
                              className="delete-btn"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAnnotationDelete(annotation.id);
                              }}
                            >
                              Delete
                            </button>
                          </div>
                          <p>Class: {classes[annotation.classId] || 'Unknown'}</p>
                          <p>Center: ({annotation.centerX.toFixed(3)}, {annotation.centerY.toFixed(3)})</p>
                          <p>Size: {annotation.width.toFixed(3)} × {annotation.height.toFixed(3)}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </>
              )}
            </div>

            {/* Main Canvas Area */}
            <div className="canvas-container">
              <div className="canvas-wrapper">
                {currentImage ? (
                  <Stage
                    ref={stageRef}
                    width={stageSize.width}
                    height={stageSize.height}
                    onMouseDown={(e) => {
                      handleMouseDown(e);
                      handleStageMouseDown(e);
                    }}
                    onMouseMove={(e) => {
                      handleMouseMove(e);
                      handleStageMouseMove(e);
                    }}
                    onMouseUp={handleMouseUp}
                    onWheel={handleZoom}
                    scaleX={scale}
                    scaleY={scale}
                    x={stagePos.x}
                    y={stagePos.y}
                    style={{ cursor: tool === 'rectangle' || tool === 'patch' ? 'crosshair' : isDragging || isResizing ? 'move' : 'default' }}
                    onMouseEnter={handleStageMouseEnter}
                    onMouseLeave={handleStageMouseLeave}
                  >
                    <Layer>

                      {/* Image */}
                      <KonvaImage
                        ref={imageRef}
                        image={(() => {
                          const img = new window.Image();
                          img.src = currentImage.src;
                          return img;
                        })()}
                        x={0}
                        y={0}
                        width={stageSize.width}
                        height={stageSize.height}
                      />

                      {/* Patches (Draw these AFTER image to be visible on top) */}
                      {patches && patches.map(patch => {
                        const x = patch.x * stageSize.width;
                        const y = patch.y * stageSize.height;
                        const w = patch.width * stageSize.width;
                        const h = patch.height * stageSize.height;
                        return (
                          <Rect
                            key={patch.id}
                            x={x}
                            y={y}
                            width={w}
                            height={h}
                            fill="white"
                            opacity={1}
                          />
                        );
                      })}

                      {/* Crosshair lines */}
                      {showCrosshair && (tool === 'rectangle' || tool === 'patch') && (
                        <>
                          <Line
                            points={[crosshairPos.x, 0, crosshairPos.x, stageSize.height]}
                            stroke="#000000"
                            strokeWidth={1}
                            dash={[5, 5]}
                          />
                          <Line
                            points={[0, crosshairPos.y, stageSize.width, crosshairPos.y]}
                            stroke="#000000"
                            strokeWidth={1}
                            dash={[5, 5]}
                          />
                        </>
                      )}

                      {/* Render Ghost Annotation */}
                      {ghostAnnotation && (
                        <Rect
                          x={ghostAnnotation.x}
                          y={ghostAnnotation.y}
                          width={ghostAnnotation.width}
                          height={ghostAnnotation.height}
                          stroke={getClassColor(ghostAnnotation.classId)}
                          strokeWidth={1}
                          dash={[5, 5]}
                          opacity={0.6}
                          listening={false} // Don't intercept events
                        />
                      )}

                      {/* Existing Annotations */}
                      {annotations.map((annotation) => {
                        const pixelCoords = normalizedToPixel(
                          annotation,
                          stageSize.width,
                          stageSize.height
                        );

                        const x = pixelCoords.x - pixelCoords.width / 2;
                        const y = pixelCoords.y - pixelCoords.height / 2;
                        const classColor = getClassColor(annotation.classId);

                        // Check if this annotation is selected (single or multiple)
                        const isSelected = (selectedAnnotation && selectedAnnotation.id === annotation.id) ||
                          selectedAnnotations.includes(annotation.id);

                        return (
                          <React.Fragment key={annotation.id}>
                            <Rect
                              x={x}
                              y={y}
                              width={pixelCoords.width}
                              height={pixelCoords.height}
                              stroke={isSelected ? "#ff0000" : classColor}
                              strokeWidth={isSelected ? 2 : 1}
                              fill={isSelected ? "rgba(255, 0, 0, 0.3)" : `rgba(${parseInt(classColor.slice(1, 3), 16)}, ${parseInt(classColor.slice(3, 5), 16)}, ${parseInt(classColor.slice(5, 7), 16)}, 0.2)`}
                              onClick={(e) => handleAnnotationSelect(annotation, e.evt)}
                              onContextMenu={(e) => handleContextMenu(e, annotation)}
                              onMouseEnter={(e) => {
                                setHoveredAnnotation(annotation);
                              }}
                              onMouseLeave={(e) => {
                                setHoveredAnnotation(null);
                              }}
                            />

                            {/* Resize handles for selected annotation */}
                            {selectedAnnotation && selectedAnnotation.id === annotation.id && (
                              <>
                                {/* Northwest handle */}
                                <Rect
                                  x={x - 5 / scale}
                                  y={y - 5 / scale}
                                  width={10 / scale}
                                  height={10 / scale}
                                  fill="#ffffff"
                                  stroke="#000000"
                                  strokeWidth={1 / scale}
                                />
                                {/* Northeast handle */}
                                <Rect
                                  x={x + pixelCoords.width - 5 / scale}
                                  y={y - 5 / scale}
                                  width={10 / scale}
                                  height={10 / scale}
                                  fill="#ffffff"
                                  stroke="#000000"
                                  strokeWidth={1 / scale}
                                />
                                {/* Southwest handle */}
                                <Rect
                                  x={x - 5 / scale}
                                  y={y + pixelCoords.height - 5 / scale}
                                  width={10 / scale}
                                  height={10 / scale}
                                  fill="#ffffff"
                                  stroke="#000000"
                                  strokeWidth={1 / scale}
                                />
                                {/* Southeast handle */}
                                <Rect
                                  x={x + pixelCoords.width - 5 / scale}
                                  y={y + pixelCoords.height - 5 / scale}
                                  width={10 / scale}
                                  height={10 / scale}
                                  fill="#ffffff"
                                  stroke="#000000"
                                  strokeWidth={1 / scale}
                                />
                              </>
                            )}
                          </React.Fragment>
                        );
                      })}

                      {/* Hover Tooltip */}
                      {hoveredAnnotation && (
                        (() => {
                          const annotation = hoveredAnnotation;
                          const pixelCoords = normalizedToPixel(
                            annotation,
                            stageSize.width,
                            stageSize.height
                          );

                          const x = pixelCoords.x - pixelCoords.width / 2;
                          const y = pixelCoords.y - pixelCoords.height / 2;
                          const classColor = getClassColor(annotation.classId);

                          return (
                            <Text
                              x={x}
                              y={y - 20}
                              text={classes[annotation.classId] || 'Unknown'}
                              fill={classColor}
                              fontSize={14}
                              fontStyle="bold"
                              shadowColor="black"
                              shadowBlur={2}
                              shadowOpacity={0.5}
                            />
                          );
                        })()
                      )}

                      {/* New Annotation Being Drawn */}
                      {newAnnotation && (
                        <Rect
                          x={Math.min(newAnnotation.x, newAnnotation.x + newAnnotation.width)}
                          y={Math.min(newAnnotation.y, newAnnotation.y + newAnnotation.height)}
                          width={Math.abs(newAnnotation.width)}
                          height={Math.abs(newAnnotation.height)}
                          fill={newAnnotation.type === 'patch' ? "white" : "rgba(255, 0, 0, 0.1)"}
                          stroke={newAnnotation.type === 'patch' ? "black" : "#ff0000"}
                          strokeWidth={1}
                          dash={newAnnotation.type === 'patch' ? [] : [5, 5]}
                        />
                      )}
                    </Layer>
                  </Stage>
                ) : (
                  <div style={{ textAlign: 'center', color: '#7f8c8d' }}>
                    <h2>🖼️ Upload a Dataset to Get Started</h2>
                    <p>Drag and drop a ZIP file containing your dataset</p>
                  </div>
                )}
              </div>

              {/* Tools Panel */}
              <div className="tools-panel">
                <button
                  className="button"
                  onClick={goToFirstImage}
                  disabled={currentImageIndex <= 0}
                  title="Go to First Image"
                >
                  ⏮ First
                </button>
                <button
                  className="button"
                  onClick={goToPreviousImage}
                  disabled={currentImageIndex <= 0}
                >
                  ◀ Previous
                </button>

                <span>
                  Image {currentImageIndex + 1} of {images.length}
                </span>

                <button
                  className="button"
                  onClick={goToNextImage}
                  disabled={currentImageIndex >= images.length - 1}
                >
                  Next ▶
                </button>
                <button
                  className="button"
                  onClick={goToLastImage}
                  disabled={currentImageIndex >= images.length - 1}
                  title="Go to Last Image"
                >
                  Last ⏭
                </button>

                <div style={{ width: '20px' }}></div> {/* Spacer */}

                <button
                  className="button"
                  onClick={handleDeleteImage}
                  style={{ backgroundColor: '#c0392b', color: 'white' }}
                  title="Delete current image and exclude from download"
                >
                  🗑️ Delete Image
                </button>
              </div>
            </div>
          </div>

          <div className="status-bar">
            {dataset ? (
              <span>Dataset loaded: {dataset.name || 'Uploaded dataset'} | Split: {datasetSplit} ({images.length} images)</span>
            ) : (
              <span>Ready to load dataset</span>
            )}
            {tool === 'rectangle' && (
              <span style={{ marginLeft: '20px' }}>Drawing rectangles: Click and drag on the image</span>
            )}
            {tool === 'select' && selectedAnnotation && (
              <span style={{ marginLeft: '20px' }}>Selected annotation: Drag to move, use corner handles to resize</span>
            )}
          </div>

          {/* Context Menu */}
          <ContextMenu
            x={contextMenu.x}
            y={contextMenu.y}
            visible={contextMenu.visible}
            onClose={closeContextMenu}
            options={getContextMenuOptions()}
            annotation={contextMenu.annotation}
          />
        </>
      ) : currentView === 'dashboard' ? (
        <Dashboard
          images={images}
          classes={classes}
          onBackToEditor={() => setCurrentView('editor')}
          onImagesUpdate={(updatedData) => {
            // Check if we're dealing with renamed classes
            if (updatedData && updatedData.images && updatedData.classes) {
              // Handle class rename/delete operation
              handleClassRename(updatedData.images, updatedData.classes);
            } else {
              // Handle regular image updates (merge/delete operations)
              setImages(updatedData);
              // Update annotations for the current image
              if (updatedData[currentImageIndex]) {
                setAnnotations(updatedData[currentImageIndex].annotations || []);
              }
            }
          }}
        />
      ) : currentView === 'merge' ? (
        <MergeDatasets
          onBackToEditor={() => setCurrentView('editor')}
        />
      ) : currentView === 'testing' ? (
        <TestingSection
          onBackToEditor={() => setCurrentView('editor')}
        />
      ) : currentView === 'monitor' ? (
        <DatasetMonitor
          images={images}
          classes={classes}
          datasetSplit={datasetSplit}
          availableSplits={availableSplits}
          onDatasetSplitChange={handleDatasetSplitChange}
          onImageSelect={handleImageSelect}
          onBackToEditor={() => setCurrentView('editor')}
        />
      ) : null}
    </div>
  );
};

export default App;