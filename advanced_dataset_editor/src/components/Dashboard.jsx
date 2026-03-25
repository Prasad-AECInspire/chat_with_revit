import React, { useState, useEffect, useRef } from "react";
import AddClass from "./AddClass";
import SimilarityService from "../services/SimilarityService";
import { useNotification } from "./NotificationContext";
import SearchableDropdown from "./SearchableDropdown";

const Dashboard = ({
  images,
  classes,
  onBackToEditor,
  onImagesUpdate,
  addNewClass,
}) => {
  const { showNotification } = useNotification();

  // ── Shared Tailwind class helpers ──────────────────────────
  const btn = "inline-flex items-center gap-1.5 px-4 py-2 bg-white/5 hover:bg-white/10 border border-white/10 hover:border-yellow-400/50 text-zinc-300 hover:text-yellow-300 rounded-xl text-xs font-semibold transition-all cursor-pointer disabled:opacity-30 disabled:cursor-not-allowed shadow-lg active:scale-95";
  const btnPrimary = "inline-flex items-center gap-1.5 px-4 py-2 bg-gradient-to-r from-yellow-500 to-yellow-400 hover:from-yellow-400 hover:to-yellow-300 border border-yellow-300/20 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-[0_4px_20px_rgba(245,197,24,0.25)] active:scale-95";
  const cardCls = "bg-zinc-900/40 backdrop-blur-xl border border-white/5 rounded-2xl p-6 shadow-2xl hover:border-yellow-400/20 transition-all group relative overflow-hidden";
  const inputCls = "bg-zinc-950/50 border border-white/5 focus:border-yellow-400/50 focus:ring-4 focus:ring-yellow-400/10 rounded-xl px-4 py-2.5 text-xs text-zinc-100 placeholder-zinc-600 outline-none transition-all w-full backdrop-blur-md";
  const labelCls = "block text-[10px] font-bold uppercase tracking-[0.2em] text-zinc-500 mb-3 ml-1 opacity-80";
  const formGroup = "mb-6";

  const [classStats, setClassStats] = useState([]);
  const [totalAnnotations, setTotalAnnotations] = useState(0);
  const [totalImages, setTotalImages] = useState(0);
  const [sourceClass, setSourceClass] = useState("");

  const [targetClass, setTargetClass] = useState("");
  const [mergedImages, setMergedImages] = useState(null);
  const [renameClassId, setRenameClassId] = useState("");
  const [newClassName, setNewClassName] = useState("");
  const [mergeAllClassName, setMergeAllClassName] = useState("");
  const [selectedClassForCrops, setSelectedClassForCrops] = useState(null);
  const [classCrops, setClassCrops] = useState([]);
  const [showCropViewer, setShowCropViewer] = useState(false);
  const [classPreviewThumbnails, setClassPreviewThumbnails] = useState({});
  const [currentPage, setCurrentPage] = useState(1);
  const [totalCrops, setTotalCrops] = useState(0);
  const [cropMetadata, setCropMetadata] = useState([]);
  const itemsPerPage = 50;

  // Smart Sort State
  const [isSmartSorting, setIsSmartSorting] = useState(false);
  const [smartSortProgress, setSmartSortProgress] = useState({
    current: 0,
    total: 0,
  });
  const [showSmartSortModal, setShowSmartSortModal] = useState(false);
  const [smartSortCurrentCrop, setSmartSortCurrentCrop] = useState(null);
  const [smartSortSuggestion, setSmartSortSuggestion] = useState(null);
  const [smartSortNewClassInput, setSmartSortNewClassInput] = useState("");
  const classCentroidsRef = useRef({}); // Store class embeddings { "Cat": tensor, ... }
  const [isFindingSimilar, setIsFindingSimilar] = useState(false);

  // Report State
  const [showReportModal, setShowReportModal] = useState(false);
  const [classReportData, setClassReportData] = useState([]);

  // Multi-select state
  const [selectedLabels, setSelectedLabels] = useState(new Set()); // Array of selected crop IDs
  const [bulkSearchTerm, setBulkSearchTerm] = useState("");
  const [isBulkDropdownOpen, setIsBulkDropdownOpen] = useState(false);
  const dropdownRef = useRef(null);
  const [isSelectionMode, setIsSelectionMode] = useState(false); // Toggle selection mode

  // Click outside to close dropdown
  useEffect(() => {
    function handleClickOutside(event) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsBulkDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    // Calculate statistics
    if (images && images.length > 0) {
      // Total images
      setTotalImages(images.length);

      // Initialize class statistics
      const stats = classes.map((cls, index) => ({
        id: index,
        name: cls,
        count: 0,
        percentage: 0,
      }));

      // Count annotations per class
      let totalAnnotationsCount = 0;
      images.forEach((image) => {
        if (image.annotations) {
          image.annotations.forEach((annotation) => {
            if (annotation.classId >= 0 && annotation.classId < stats.length) {
              stats[annotation.classId].count++;
              totalAnnotationsCount++;
            }
          });
        }
      });

      // Calculate percentages
      stats.forEach((stat) => {
        stat.percentage =
          totalAnnotationsCount > 0
            ? ((stat.count / totalAnnotationsCount) * 100).toFixed(2)
            : 0;
      });

      setClassStats(stats);
      setTotalAnnotations(totalAnnotationsCount);

      // Generate Detailed Report Data
      const reportData = classes.map((cls, index) => {
        let annotationCount = 0;
        let imageCount = 0; // Number of images containing this class

        images.forEach((image) => {
          if (image.annotations) {
            const hasClass = image.annotations.some(
              (ann) => ann.classId === index
            );
            if (hasClass) imageCount++;

            image.annotations.forEach((ann) => {
              if (ann.classId === index) annotationCount++;
            });
          }
        });

        return {
          id: index,
          name: cls,
          annotationCount: annotationCount,
          imageCount: imageCount,
          density:
            imageCount > 0 ? (annotationCount / imageCount).toFixed(1) : 0,
        };
      });
      setClassReportData(reportData);
    } else {
      // Reset if no images
      setClassStats(
        classes.map((cls, index) => ({
          id: index,
          name: cls,
          count: 0,
          percentage: 0,
        }))
      );
      setTotalAnnotations(0);
      setTotalImages(0);
    }
  }, [images, classes]);

  // Generate preview thumbnails for each class
  useEffect(() => {
    const generatePreviewThumbnails = async () => {
      if (!images || images.length === 0 || !classes || classes.length === 0) {
        setClassPreviewThumbnails({});
        return;
      }

      const thumbnailPromises = classes.map(async (cls, classId) => {
        let foundAnnotation = null;
        let foundImage = null;

        for (const image of images) {
          if (image.annotations) {
            const annotation = image.annotations.find((ann) => ann.classId === classId);
            if (annotation) { foundAnnotation = annotation; foundImage = image; break; }
          }
        }

        if (foundAnnotation && foundImage) {
          try {
            const resp = await fetch(foundImage.src);
            const blob = await resp.blob();
            const bitmap = await createImageBitmap(blob);
            const imgW = bitmap.width;
            const imgH = bitmap.height;
            if (!imgW || !imgH) return null;
            const cropX = Math.max(0, (foundAnnotation.centerX - foundAnnotation.width / 2) * imgW);
            const cropY = Math.max(0, (foundAnnotation.centerY - foundAnnotation.height / 2) * imgH);
            const cropW = Math.max(1, Math.min(foundAnnotation.width * imgW, imgW - cropX));
            const cropH = Math.max(1, Math.min(foundAnnotation.height * imgH, imgH - cropY));
            const maxSize = 80;
            const scale = Math.min(maxSize / cropW, maxSize / cropH, 1);
            const canvas = document.createElement("canvas");
            canvas.width = Math.max(1, cropW * scale);
            canvas.height = Math.max(1, cropH * scale);
            const ctx = canvas.getContext("2d");
            ctx.drawImage(bitmap, cropX, cropY, cropW, cropH, 0, 0, canvas.width, canvas.height);
            bitmap.close?.();
            return { classId, url: canvas.toDataURL("image/jpeg", 0.85) };
          } catch (e) {
            console.error(`Thumbnail error class ${classId}:`, e);
            return null;
          }
        }
        return null;

      });

      const results = await Promise.all(thumbnailPromises);
      // Build the thumbnails map from results
      const thumbnails = {};
      results.forEach((res) => {
        if (res) thumbnails[res.classId] = res.url;
      });
      setClassPreviewThumbnails(thumbnails);
    };

    generatePreviewThumbnails();
  }, [images, classes]);


  // Function to extract annotation crop metadata for a specific class (lightweight)
  const extractClassCropMetadata = (classId, imageData = null) => {
    const metadata = [];
    const sourceImages = imageData || images;

    sourceImages.forEach((image, imageIndex) => {
      if (image.annotations) {
        image.annotations.forEach((annotation, annotationIndex) => {
          if (annotation.classId === classId) {
            // Store only metadata, not the actual image processing
            metadata.push({
              id: `${imageIndex}-${annotationIndex}`,
              imageName: image.name,
              imageIndex: imageIndex,
              annotationIndex: annotationIndex,
              annotation: annotation,
              imageSrc: image.src,
            });
          }
        });
      }
    });

    return metadata;
  };

  // Function to process crops for a specific page
  const processPageCrops = async (metadata, page, perPage) => {
    const startIndex = (page - 1) * perPage;
    const endIndex = Math.min(startIndex + perPage, metadata.length);
    const pageMetadata = metadata.slice(startIndex, endIndex);

    // Helper: decode any src (blob:, data:, http:) into an ImageBitmap reliably
    const srcToImageBitmap = async (src) => {
      try {
        if (src.startsWith("blob:") || src.startsWith("http")) {
          const resp = await fetch(src);
          const blob = await resp.blob();
          return await createImageBitmap(blob);
        } else if (src.startsWith("data:")) {
          const resp = await fetch(src);
          const blob = await resp.blob();
          return await createImageBitmap(blob);
        }
      } catch (e) {
        // Fallback: HTMLImageElement
        return new Promise((res, rej) => {
          const img = new Image();
          img.onload = () => res(img);
          img.onerror = rej;
          img.src = src;
          if (img.complete && img.naturalWidth > 0) res(img);
        });
      }
    };

    // Process only the crops for this page
    const processedCrops = await Promise.all(
      pageMetadata.map(async (cropMeta) => {
        const fallback = { id: cropMeta.id, imageName: cropMeta.imageName, imageIndex: cropMeta.imageIndex, annotationIndex: cropMeta.annotationIndex, cropSrc: cropMeta.imageSrc, annotation: cropMeta.annotation };
        try {
          const bitmap = await srcToImageBitmap(cropMeta.imageSrc);
          const imgW = bitmap.width;
          const imgH = bitmap.height;
          if (!imgW || !imgH) return fallback;

          const cropX = Math.max(0, (cropMeta.annotation.centerX - cropMeta.annotation.width / 2) * imgW);
          const cropY = Math.max(0, (cropMeta.annotation.centerY - cropMeta.annotation.height / 2) * imgH);
          const cropW = Math.max(1, Math.min(cropMeta.annotation.width * imgW, imgW - cropX));
          const cropH = Math.max(1, Math.min(cropMeta.annotation.height * imgH, imgH - cropY));

          const canvas = document.createElement("canvas");
          canvas.width = cropW;
          canvas.height = cropH;
          const ctx = canvas.getContext("2d");
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = "high";
          ctx.drawImage(bitmap, cropX, cropY, cropW, cropH, 0, 0, cropW, cropH);
          bitmap.close?.(); // free memory
          const cropDataUrl = canvas.toDataURL("image/jpeg", 0.88);
          return { id: cropMeta.id, imageName: cropMeta.imageName, imageIndex: cropMeta.imageIndex, annotationIndex: cropMeta.annotationIndex, cropSrc: cropDataUrl, annotation: cropMeta.annotation };
        } catch (e) {
          console.error("Crop render error:", e, cropMeta.imageName);
          return fallback;
        }
      })
    );

    return processedCrops;
  };



  // Function to view crops for a specific class with pagination
  const viewClassCrops = async (classId, className) => {
    setSelectedClassForCrops({ id: classId, name: className });

    // Extract metadata for all crops (lightweight operation)
    const metadata = extractClassCropMetadata(classId);
    setCropMetadata(metadata);
    setTotalCrops(metadata.length);
    setCurrentPage(1);

    // Process only the first page
    const processedCrops = await processPageCrops(metadata, 1, itemsPerPage);
    setClassCrops(processedCrops);
    setShowCropViewer(true);
  };

  // Function to load a specific page
  const loadPage = async (page) => {
    if (page < 1 || page > Math.ceil(totalCrops / itemsPerPage)) {
      return;
    }

    setCurrentPage(page);
    const processedCrops = await processPageCrops(
      cropMetadata,
      page,
      itemsPerPage
    );
    setClassCrops(processedCrops);
  };

  // Function to close crop viewer
  const closeCropViewer = () => {
    setShowCropViewer(false);
    setSelectedClassForCrops(null);
    setClassCrops([]);
    setCropMetadata([]);
    setTotalCrops(0);
    setCurrentPage(1);
    setSelectedLabels(new Set());
    setIsSelectionMode(false);
  };

  // ============================================
  // MULTI-SELECT FUNCTIONS
  // ============================================

  // Function to toggle selection mode
  const toggleSelectionMode = () => {
    setIsSelectionMode(!isSelectionMode);
    if (isSelectionMode) {
      setSelectedLabels(new Set());
    }
  };

  // Function to toggle individual crop selection
  const toggleCropSelection = (cropId) => {
    setSelectedLabels((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(cropId)) {
        newSet.delete(cropId);
      } else {
        newSet.add(cropId);
      }
      return newSet;
    });
  };

  // Function to select all crops on current page
  const selectAllOnPage = () => {
    const allCropIds = classCrops.map((crop) => crop.id);
    setSelectedLabels(new Set(allCropIds));
  };

  // Function to deselect all
  const deselectAll = () => {
    setSelectedLabels(new Set());
  };

  // Function to bulk delete selected crops
  const bulkDeleteCrops = async () => {
    if (selectedLabels.size === 0) {
      showNotification("No crops selected", "warning");
      return;
    }

    if (!window.confirm(`Delete ${selectedLabels.size} selected crop(s)?`)) {
      return;
    }

    const updatedImages = JSON.parse(JSON.stringify(images));
    const cropsToDelete = [];

    selectedLabels.forEach((cropId) => {
      const crop = classCrops.find((c) => c.id === cropId);
      if (crop) {
        cropsToDelete.push({
          imageIndex: crop.imageIndex,
          annotationIndex: crop.annotationIndex,
        });
      }
    });

    // Sort in reverse order to avoid index shift issues
    cropsToDelete.sort((a, b) => {
      if (a.imageIndex !== b.imageIndex) {
        return b.imageIndex - a.imageIndex;
      }
      return b.annotationIndex - a.annotationIndex;
    });

    // Delete annotations
    cropsToDelete.forEach(({ imageIndex, annotationIndex }) => {
      if (updatedImages[imageIndex] && updatedImages[imageIndex].annotations) {
        updatedImages[imageIndex].annotations.splice(annotationIndex, 1);
      }
    });

    // Refresh crop viewer
    if (selectedClassForCrops) {
      const metadata = extractClassCropMetadata(
        selectedClassForCrops.id,
        updatedImages
      );
      setCropMetadata(metadata);
      setTotalCrops(metadata.length);

      const totalPages = Math.ceil(metadata.length / itemsPerPage);
      const newPage =
        currentPage > totalPages ? Math.max(1, totalPages) : currentPage;
      setCurrentPage(newPage);

      const processedCrops = await processPageCrops(
        metadata,
        newPage,
        itemsPerPage
      );
      setClassCrops(processedCrops);
    }

    setSelectedLabels(new Set());

    if (onImagesUpdate) {
      onImagesUpdate({
        images: updatedImages,
        classes: classes,
      });
    }

    showNotification(
      `Deleted ${cropsToDelete.length} crop(s) successfully!`,
      "success"
    );
  };

  // Function to bulk change class for selected crops
  const bulkChangeClass = async (newClassId) => {
    if (selectedLabels.size === 0) {
      showNotification("No crops selected", "warning");
      return;
    }

    const className = classes[newClassId];
    if (
      !window.confirm(
        `Change ${selectedLabels.size} selected crop(s) to class "${className}"?`
      )
    ) {
      return;
    }

    const updatedImages = JSON.parse(JSON.stringify(images));

    selectedLabels.forEach((cropId) => {
      const crop = classCrops.find((c) => c.id === cropId);
      if (
        crop &&
        updatedImages[crop.imageIndex] &&
        updatedImages[crop.imageIndex].annotations &&
        updatedImages[crop.imageIndex].annotations[crop.annotationIndex]
      ) {
        updatedImages[crop.imageIndex].annotations[
          crop.annotationIndex
        ].classId = parseInt(newClassId);
      }
    });

    // Refresh crop viewer
    if (selectedClassForCrops) {
      const metadata = extractClassCropMetadata(
        selectedClassForCrops.id,
        updatedImages
      );
      setCropMetadata(metadata);
      setTotalCrops(metadata.length);

      const totalPages = Math.ceil(metadata.length / itemsPerPage);
      const newPage =
        currentPage > totalPages ? Math.max(1, totalPages) : currentPage;
      setCurrentPage(newPage);

      const processedCrops = await processPageCrops(
        metadata,
        newPage,
        itemsPerPage
      );
      setClassCrops(processedCrops);
    }

    setSelectedLabels(new Set());

    if (onImagesUpdate) {
      onImagesUpdate({
        images: updatedImages,
        classes: classes,
      });
    }

    showNotification(
      `Changed ${selectedLabels.size} crop(s) to class "${className}" successfully!`,
      "success"
    );
  };

  // Function to remove a specific annotation from the dataset
  const removeAnnotationAndImageFromFile = async (
    imageIndex,
    annotationIndex
  ) => {
    if (!window.confirm("Remove annotation and image from disk?")) return;

    const updatedImages = JSON.parse(JSON.stringify(images));
    const image = updatedImages[imageIndex];
    const annotation = image.annotations[annotationIndex];

    // Remove from memory
    image.annotations.splice(annotationIndex, 1);

    // Remove from disk if paths exist
    if (annotation.annotationFilePath) {
      try {
        // Assuming 'invoke' is defined elsewhere or imported (e.g., from tauri)
        // await invoke("delete_annotation_from_disk", {
        //   annotationPath: annotation.annotationFilePath
        // });
      } catch (err) {
        console.error("Failed to delete annotation from disk:", err);
      }
    }

    if (image.imagePath) {
      try {
        // Assuming 'invoke' is defined elsewhere or imported (e.g., from tauri)
        // await invoke("delete_image", { imagePath: image.imagePath });
      } catch (err) {
        console.error("Failed to delete image from disk:", err);
      }
    }

    // Refresh UI
    if (selectedClassForCrops) {
      const metadata = extractClassCropMetadata(
        selectedClassForCrops.id,
        updatedImages
      );
      setCropMetadata(metadata);
      setTotalCrops(metadata.length);

      const totalPages = Math.ceil(metadata.length / itemsPerPage);
      const newPage =
        currentPage > totalPages ? Math.max(1, totalPages) : currentPage;
      setCurrentPage(newPage);

      const processedCrops = await processPageCrops(
        metadata,
        newPage,
        itemsPerPage
      );
      setClassCrops(processedCrops);
    }

    onImagesUpdate({
      images: updatedImages,
      classes: classes,
    });
  };

  // Function to change the class of a specific annotation
  const changeAnnotationClass = async (
    imageIndex,
    annotationIndex,
    newClassId
  ) => {
    // Create a deep copy of images
    const updatedImages = images.map((image) => ({
      ...image,
      annotations: image.annotations
        ? image.annotations.map((ann) => ({ ...ann }))
        : [],
    }));

    // Update the annotation's class
    if (
      updatedImages[imageIndex] &&
      updatedImages[imageIndex].annotations &&
      updatedImages[imageIndex].annotations[annotationIndex]
    ) {
      updatedImages[imageIndex].annotations[annotationIndex].classId =
        parseInt(newClassId);
    }

    // Refresh the crop viewer IMMEDIATELY - the crop will disappear from current class view
    if (selectedClassForCrops) {
      // Re-extract metadata from the updated images
      const metadata = extractClassCropMetadata(
        selectedClassForCrops.id,
        updatedImages
      );
      setCropMetadata(metadata);
      setTotalCrops(metadata.length);

      // If current page is now empty, go to previous page
      const totalPages = Math.ceil(metadata.length / itemsPerPage);
      const newPage =
        currentPage > totalPages ? Math.max(1, totalPages) : currentPage;
      setCurrentPage(newPage);

      // Reload the page with updated data
      const processedCrops = await processPageCrops(
        metadata,
        newPage,
        itemsPerPage
      );
      setClassCrops(processedCrops);
    }

    // Update the parent component after UI refresh
    if (onImagesUpdate) {
      onImagesUpdate({
        images: updatedImages,
        classes: classes,
      });
    }
  };

  // Function to merge classes
  const mergeClasses = () => {
    // if (!sourceClass || !targetClass || sourceClass === targetClass) {
    //   alert('Please select different source and target classes');
    //   return;
    // }

    const sourceClassId = classes.findIndex((cls) => cls === sourceClass);
    const targetClassId = classes.findIndex((cls) => cls === targetClass);

    if (sourceClassId === -1 || targetClassId === -1) {
      showNotification("Invalid class selection", "error");
      return;
    }

    // Create a deep copy of images to modify - only copy necessary properties
    const updatedImages = images.map((image) => ({
      ...image,
      annotations: image.annotations
        ? image.annotations.map((ann) => ({ ...ann }))
        : [],
    }));

    // Update all annotations of the source class to the target class
    updatedImages.forEach((image) => {
      if (image.annotations) {
        image.annotations.forEach((annotation) => {
          if (annotation.classId === sourceClassId) {
            annotation.classId = targetClassId;
          }
        });
      }
    });

    // Update the classes array by removing the source class
    const updatedClasses = [...classes];
    updatedClasses.splice(sourceClassId, 1);

    // Reindex annotations to account for the removed class
    updatedImages.forEach((image) => {
      if (image.annotations) {
        image.annotations = image.annotations.map((annotation) => {
          if (annotation.classId > sourceClassId) {
            return { ...annotation, classId: annotation.classId - 1 };
          }
          return annotation;
        });
      }
    });

    // Pass both updated images and classes to parent component
    if (onImagesUpdate) {
      onImagesUpdate({
        images: updatedImages,
        classes: updatedClasses,
      });
    }

    // Alert the user of successful merge
    showNotification(
      `Successfully merged ${sourceClass} into ${targetClass}`,
      "success"
    );

    // Reset selections
    setSourceClass("");
    setTargetClass("");
  };

  // Merge ALL classes into a single class with the provided name
  const mergeAllClasses = () => {
    if (!mergeAllClassName.trim()) {
      showNotification(
        "Please enter a class name to merge all classes into.",
        "warning"
      );
      return;
    }
    // Deep copy images
    const updatedImages = images.map((image) => ({
      ...image,
      annotations: image.annotations
        ? image.annotations.map((ann) => ({ ...ann }))
        : [],
    }));
    // Set every annotation's classId to 0
    updatedImages.forEach((img) => {
      if (img.annotations && Array.isArray(img.annotations)) {
        img.annotations = img.annotations.map((a) => ({ ...a, classId: 0 }));
      }
    });
    // Single class array
    const updatedClasses = [mergeAllClassName.trim()];
    // Send up to parent
    if (onImagesUpdate) {
      onImagesUpdate({ images: updatedImages, classes: updatedClasses });
    }
    showNotification(
      `Merged all classes into "${mergeAllClassName.trim()}"`,
      "success"
    );
    setMergeAllClassName("");
  };

  // Function to handle class deletion
  const deleteClass = (classId) => {
    if (!window.confirm(`Are you sure you want to delete this class?`)) {
      return;
    }

    // Create a deep copy of images to modify
    const updatedImages = images.map((image) => ({
      ...image,
      annotations: image.annotations
        ? image.annotations.map((ann) => ({ ...ann }))
        : [],
    }));

    // Remove all annotations of the class to be deleted
    updatedImages.forEach((image) => {
      if (image.annotations) {
        image.annotations = image.annotations.filter(
          (annotation) => annotation.classId !== classId
        );
      }
    });

    // Update the classes array by removing the deleted class
    // We need to reindex all annotations with classId > classId
    const updatedClasses = [...classes];
    updatedClasses.splice(classId, 1);

    // Reindex annotations to account for the removed class
    updatedImages.forEach((image) => {
      if (image.annotations) {
        image.annotations = image.annotations.map((annotation) => {
          if (annotation.classId > classId) {
            return { ...annotation, classId: annotation.classId - 1 };
          }
          return annotation;
        });
      }
    });

    // Pass both updated images and classes to parent component
    if (onImagesUpdate) {
      onImagesUpdate({
        images: updatedImages,
        classes: updatedClasses,
      });
    }

    // Alert the user of successful deletion
    showNotification(`Class deleted successfully`, "success");
  };

  // Function to rename a class
  const renameClass = () => {
    if (!renameClassId || !newClassName.trim()) {
      showNotification("Please select a class and enter a new name", "warning");
      return;
    }

    const classId = parseInt(renameClassId);
    if (isNaN(classId) || classId < 0 || classId >= classes.length) {
      showNotification("Invalid class selection", "error");
      return;
    }

    if (classes.includes(newClassName.trim())) {
      showNotification("A class with this name already exists", "error");
      return;
    }

    // Create a deep copy of images to modify
    const updatedImages = images.map((image) => ({
      ...image,
      annotations: image.annotations
        ? image.annotations.map((ann) => ({ ...ann }))
        : [],
    }));

    // Update the class name in the classes array
    const updatedClasses = [...classes];
    updatedClasses[classId] = newClassName.trim();

    // Pass both updated images and classes to parent component
    if (onImagesUpdate) {
      onImagesUpdate({
        images: updatedImages,
        classes: updatedClasses,
      });
    }

    // Alert the user of successful rename
    showNotification(
      `Class renamed successfully to "${newClassName.trim()}"`,
      "success"
    );

    // Reset selections
    setRenameClassId("");
    setNewClassName("");
  };

  // --- Smart Sort Logic ---

  const startSmartSort = async () => {
    console.log("🚀 Starting Smart Sort...");
    if (!selectedClassForCrops) {
      console.error("❌ No class selected for crops!");
      return;
    }

    setIsSmartSorting(true);
    setSmartSortProgress({ current: 0, total: cropMetadata.length });
    classCentroidsRef.current = {}; // Reset centroids

    console.log(
      ` Processing ${cropMetadata.length} crops for class: ${selectedClassForCrops.name}`
    );

    // 1. Calculate Centroids for EXISTING classes (except the one we are sorting)
    // We need to fetch a few samples from other classes to build their profile
    // For simplicity/performance: we'll build centroids on-the-fly or skip this if no other classes
    // Better approach: When user Confirms a class, we add that crop's embedding to that class's centroid

    // We will iterate through crops one be one (or batch)
    // CHECK FOR SELECTION:
    if (selectedLabels.size > 0) {
      console.log(
        `🔹 Smart Sorting restricted to ${selectedLabels.size} selected crops.`
      );
      // Filter metadata to only those selected
      // We need to map cropMetadata to a flexible list or handle index mapping.
      // Easiest is to add a flag or 'smartSortTargetIndices' list.
      // But processNextSmartSortCrop uses 'index' into 'cropMetadata'.
      // So let's CREATE a temporary filtered list OR complex index mapping.
      // temporary filtered list is risky if we rely on global cropMetadata for other things.
      // Actually, processNextSmartSortCrop uses cropMetadata[index].
      // Better approach: We pass a LIST of indices to process.

      const indicesToProcess = cropMetadata
        .map((_, idx) => idx)
        .filter((idx) => selectedLabels.has(cropMetadata[idx].id));

      setSmartSortProgress({ current: 0, total: indicesToProcess.length });
      // We need to change processNextSmartSortCrop to accept a LIST of indices
      // Or we can just store this list in a Ref or State.
      // Let's use a simple State for the queue.
      // Wait, let's keep it simple: Filter cropMetadata is simplest IF we don't need to save back to original indices immediately
      // But we DO needs original indices for 'changeAnnotationClass'.
      // 'cropMetadata' has 'imageIndex' and 'annotationIndex'. So filtering it is SAFE.

      const filteredMetadata = cropMetadata.filter((c) =>
        selectedLabels.has(c.id)
      );

      // We will perform smart sort on this subset.
      // We need to pass this subset to the processor.
      // Refactoring processNextSmartSortCrop to take metadata array as arg is best.
      processNextSmartSortCrop(0, filteredMetadata);
    } else {
      await processNextSmartSortCrop(0, cropMetadata);
    }
  };

  const processNextSmartSortCrop = async (
    index,
    metadataSource = cropMetadata
  ) => {
    console.log(`🔄 Processing crop index: ${index}`);
    if (index >= metadataSource.length) {
      console.log("Smart Sort Complete - Index exceeded total");
      setIsSmartSorting(false);
      showNotification("Smart Sort Complete!", "success");
      // Refresh view
      viewClassCrops(selectedClassForCrops.id, selectedClassForCrops.name);
      return;
    }

    setSmartSortProgress({ current: index + 1, total: metadataSource.length });
    const cropMeta = metadataSource[index];

    // 1. Get Image Element (create temp image)
    const img = new Image();
    img.crossOrigin = "Anonymous"; // Fix for tainted canvas
    img.src = cropMeta.imageSrc; // Full image src

    await new Promise((resolve, reject) => {
      img.onload = resolve;
      img.onerror = reject;
    });

    // We need to crop it technically for the model, or the model looks at whole image.
    // SimilarityService expects an element. We should draw crop to canvas.
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    const imgWidth = img.width;
    const imgHeight = img.height;

    const cropX =
      (cropMeta.annotation.centerX - cropMeta.annotation.width / 2) * imgWidth;
    const cropY =
      (cropMeta.annotation.centerY - cropMeta.annotation.height / 2) *
      imgHeight;
    const cropWidth = cropMeta.annotation.width * imgWidth;
    const cropHeight = cropMeta.annotation.height * imgHeight;

    canvas.width = cropWidth;
    canvas.height = cropHeight;
    ctx.drawImage(
      img,
      cropX,
      cropY,
      cropWidth,
      cropHeight,
      0,
      0,
      cropWidth,
      cropHeight
    );

    // 2. Get Suggestion
    // existingClasses names (exclude current class)
    const validCentroids = { ...classCentroidsRef.current };
    // Also include existing classes centroids if we had pre-calculated them?
    // For now, "Smart Sort" builds up knowledge during the session.

    const result = await SimilarityService.classifyCrop(canvas, validCentroids);

    setSmartSortCurrentCrop({
      ...cropMeta,
      cropSrc: canvas.toDataURL(),
      index: index,
    });

    if (result && result.match) {
      // High confidence match
      setSmartSortSuggestion({
        name: result.match,
        confidence: result.similarity,
        embedding: result.embedding,
      });
      console.log(`Match found: ${result.match} (${result.similarity})`);
      setShowSmartSortModal(true);
    } else {
      // No match / Low confidence
      console.log("❓ No confident match found");
      setSmartSortSuggestion({
        name: null,
        embedding: result
          ? result.embedding
          : await SimilarityService.getEmbedding(canvas),
      });
      setShowSmartSortModal(true);
    }
  };

  const handleSmartSortDecision = async (targetClassName) => {
    if (!targetClassName) return;

    const crop = smartSortCurrentCrop;
    const embedding = smartSortSuggestion.embedding;

    // 1. Update/Create Centroid
    // If centroid exists, average it? For simplicity, we just keep the latest or average.
    // A simple running average for tensors: new_avg = (old_avg * n + new_val) / (n + 1)
    // Here we will just overwrite or essentially let the "last seen" represent the class mostly
    // or simplistic:
    if (classCentroidsRef.current[targetClassName]) {
      // In a real app we'd average tensors
      // classCentroidsRef.current[targetClassName] = tf.add(...).div(...)
    } else {
      classCentroidsRef.current[targetClassName] = embedding;
      // Note: embedding is a tensor, we should handle disposal if replacing
    }

    // 2. Perform Move/Create Class
    let targetClassId = classes.indexOf(targetClassName);

    if (targetClassId === -1) {
      alert(
        "Dynamic class creation during Smart Sort is complex to sync. Please ensure class exists or we will add it."
      );
      // We need to use handleAddNewClassFromDashboard if available or manipulate props
      // Since classes is a prop, we depend on parent update.
      // But creating a class is async/prop-driven.
      // We will optimistic update here ?
    }

    // We will perform the "Move" logic
    // We need to find the GLOBAL image/annotation index from the crop metadata
    if (targetClassId !== -1) {
      await changeAnnotationClass(
        crop.imageIndex,
        crop.annotationIndex,
        targetClassId
      );
    } else {
      // Create class flow
      const updatedClasses = [...classes, targetClassName];
      // We must handle this via parent if possible, but Dashboard.js logic was direct.
      // Let's replicate what Dashboard.js did:
      const updatedImages = JSON.parse(JSON.stringify(images));
      // Update crop
      if (updatedImages[crop.imageIndex]?.annotations[crop.annotationIndex]) {
        updatedImages[crop.imageIndex].annotations[
          crop.annotationIndex
        ].classId = updatedClasses.length - 1;
      }

      onImagesUpdate({ images: updatedImages, classes: updatedClasses });
    }

    // 3. Next
    setShowSmartSortModal(false);
    setSmartSortNewClassInput("");

    // We need to know which metadata source we are using.
    // Hack: check if we are subsetting by looking at progress total vs global total? No.
    // Better: pass the list along or bind it.
    // Since we can't easily change args in the modal callback without state,
    // let's assume we are just incrementing index.
    // BUT wait, 'processNextSmartSortCrop' needs the list.
    // If we filtered, we need to pass that filtered list back.
    // Solution: Store 'smartSortQueue' in state/ref?
    // OR: just check if (selectedLabels.size > 0) again and reconstruct? No, efficient to reconstruct.

    let currentList = cropMetadata;
    if (selectedLabels.size > 0) {
      currentList = cropMetadata.filter((c) => selectedLabels.has(c.id));
    }

    processNextSmartSortCrop(crop.index + 1, currentList);
  };

  // --- Select Similar Logic ---

  const handleSelectSimilar = async () => {
    if (selectedLabels.size === 0) {
      alert("Please select at least one crop to find similar ones.");
      return;
    }

    setIsFindingSimilar(true);
    console.log("Finding similar crops...");

    try {
      // 1. Get embeddings for SELECTED crops (Queen/Query)
      const selectedCrops = classCrops.filter((c) => selectedLabels.has(c.id));
      const queryEmbeddings = [];

      for (const crop of selectedCrops) {
        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = crop.cropSrc;
        await new Promise((resolve) => (img.onload = resolve));
        const embedding = await SimilarityService.getEmbedding(img);
        queryEmbeddings.push(embedding);
      }

      // 2. Compare against ALL OTHER crops on the PAGE
      // (Optimization: We only look at current page 'classCrops' for instant UI feedback)
      const newSelections = new Set(selectedLabels);
      let matchCount = 0;

      for (const crop of classCrops) {
        if (selectedLabels.has(crop.id)) continue; // Already selected

        const img = new Image();
        img.crossOrigin = "Anonymous";
        img.src = crop.cropSrc;
        await new Promise((resolve) => (img.onload = resolve));

        const embedding = await SimilarityService.getEmbedding(img);

        // Check against ANY of the query embeddings
        let isMatch = false;
        for (const queryEmb of queryEmbeddings) {
          const similarity = SimilarityService.calculateSimilarity(
            queryEmb,
            embedding
          );
          if (similarity > 0.85) {
            // Threshold
            isMatch = true;
            break;
          }
        }

        if (isMatch) {
          newSelections.add(crop.id);
          matchCount++;
        }
      }

      setSelectedLabels(newSelections);
      alert(`Found and selected ${matchCount} similar crops!`);
    } catch (err) {
      console.error("Error in Select Similar:", err);
      alert("Error finding similar crops.");
    } finally {
      setIsFindingSimilar(false);
    }
  };

  const downloadReportCSV = () => {
    if (classReportData.length === 0) return;

    const headers = [
      "Class ID",
      "Class Name",
      "Total Annotations",
      "Images Containing Class",
      "Avg Anns/Image",
    ];
    const rows = classReportData.map((d) => [
      d.id,
      d.name,
      d.annotationCount,
      d.imageCount,
      d.density,
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((e) => e.join(",")),
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    const url = URL.createObjectURL(blob);
    link.setAttribute("href", url);
    link.setAttribute("download", "class_report.csv");
    link.style.visibility = "hidden";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Wrapper for adding a new class from the dashboard
  const handleAddNewClassFromDashboard = () => {
    if (!newClassName.trim()) return;
    addNewClass(newClassName.trim());
    setNewClassName("");
  };

  // Handle clicks outside the bulk change dropdown
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target)) {
        setIsBulkDropdownOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [dropdownRef]);

  return (
    <div className="flex flex-col h-screen bg-black text-zinc-100 font-sans overflow-hidden animate-in">
      {/* ── Header ── */}
      <header className="flex items-center justify-between px-6 h-[64px] flex-shrink-0 bg-zinc-950/50 backdrop-blur-xl border-b border-white/10 relative z-50">
        <div className="absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-yellow-400/30 to-transparent" />
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 rounded-xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-yellow-300 shadow-lg shadow-yellow-400/5">
            <span className="text-xl"></span>
          </div>
          <div>
            <h1 className="text-base font-bold tracking-tight text-white leading-none mb-1">Annotation Dashboard</h1>
            <p className="text-[10px] text-zinc-500 font-medium uppercase tracking-wider">Insight & Dataset Management</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <button className={btn} onClick={onBackToEditor}>
            <span className="text-lg">←</span> Back to Editor
          </button>
          <button className={btnPrimary} onClick={() => setShowReportModal(true)}>
            Export Report
          </button>
        </div>
      </header>

      {/* ── Main Content Split ── */}
      <div className="flex flex-1 overflow-hidden">
        {/* ── Sidebar: Overall Stats & Management ── */}
        <aside className="w-[380px] flex-shrink-0 bg-zinc-950 border-r border-white/10 p-6 overflow-y-auto custom-scrollbar">
          <section className="space-y-6">
            <div>
              <label className={labelCls}>Global Overview</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: "Total Images", val: totalImages, icon: "🖼️" },
                  { label: "Annotations", val: totalAnnotations, icon: "🏷️" },
                  { label: "Classes", val: classes.length, icon: "📂" },
                  { label: "Avg Density", val: totalImages > 0 ? (totalAnnotations / totalImages).toFixed(2) : 0, icon: "📈" },
                ].map((s, i) => (
                  <div key={i} className="bg-zinc-900/50 border border-white/5 rounded-2xl p-4">
                    <p className="text-[10px] text-zinc-500 font-bold uppercase mb-1">{s.label}</p>
                    <div className="flex items-baseline gap-2">
                      <span className="text-xl font-bold text-white tracking-tight">{s.val}</span>
                      <span className="text-[10px] opacity-30">{s.icon}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="h-px bg-white/5" />

            {/* Class Management Tools */}
            <div>
              <label className={labelCls}>Management Tools</label>

              {/* Merge Tools */}
              <div className="space-y-4">
                <div className="bg-zinc-900/30 border border-white/5 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-yellow-300">🔗</span>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Merge Classes</h4>
                  </div>
                  <div className="space-y-3">
                    <div>
                      <SearchableDropdown options={classes} value={sourceClass} onChange={setSourceClass} placeholder="Source (From)..." />
                    </div>
                    <div className="flex justify-center py-1 opacity-20">↓</div>
                    <div>
                      <SearchableDropdown options={classes} value={targetClass} onChange={setTargetClass} placeholder="Target (To)..." />
                    </div>
                    <button className={`${btn} w-full justify-center py-2.5 bg-zinc-100 text-zinc-950 border-transparent hover:bg-white`}
                      onClick={mergeClasses} disabled={!sourceClass || !targetClass || sourceClass === targetClass}>
                      Confirm Merge
                    </button>
                  </div>
                </div>

                <div className="bg-zinc-900/30 border border-white/5 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-yellow-300">✏️</span>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Rename Class</h4>
                  </div>
                  <div className="space-y-3">
                    <SearchableDropdown options={classes} value={renameClassId !== "" ? classes[renameClassId] : ""}
                      onChange={(val) => setRenameClassId(classes.indexOf(val))} placeholder="Select class..." />
                    <input type="text" value={newClassName} onChange={(e) => setNewClassName(e.target.value)}
                      placeholder="New name..." className={inputCls} />
                    <button className={`${btn} w-full justify-center`} onClick={renameClass} disabled={!renameClassId || !newClassName.trim()}>
                      Update Name
                    </button>
                  </div>
                </div>

                <div className="bg-zinc-900/30 border border-white/5 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className="text-red-400"></span>
                    <h4 className="text-xs font-bold text-white uppercase tracking-wider">Global Merge</h4>
                  </div>
                  <div className="space-y-3">
                    <input type="text" value={mergeAllClassName} onChange={(e) => setMergeAllClassName(e.target.value)}
                      placeholder="One class for all..." className={inputCls} />
                    <button className={`${btn} w-full justify-center border-red-500/20 text-red-500 hover:bg-red-500/10`}
                      onClick={mergeAllClasses} disabled={!mergeAllClassName.trim()}>
                      Merge All to One
                    </button>
                    <p className="text-[11px] text-zinc-600 leading-tight px-1 italic">Collapse entire dataset into a single label type.</p>
                  </div>
                </div>
              </div>
            </div>
          </section>
        </aside>

        {/* ── Main View: Class Distribution Grid ── */}
        <main className="flex-1 bg-zinc-950 overflow-y-auto p-8 custom-scrollbar">
          <div className="max-w-6xl mx-auto space-y-8">
            <div className="flex items-end justify-between">
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight mb-2">Class Distribution</h2>
                <p className="text-sm text-zinc-500">Breakdown of all annotations by label type.</p>
              </div>
              <div className="bg-zinc-900/50 border border-white/5 px-4 py-2 rounded-full text-xs font-medium text-zinc-400">
                Sorted by frequency
              </div>
            </div>

            {classStats.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {classStats.sort((a, b) => b.count - a.count).map((stat) => (
                  <div key={stat.id} className={cardCls}>
                    <div className="flex items-start justify-between mb-6">
                      <div className="bg-zinc-900/50 p-2 rounded-xl group-hover:bg-yellow-400/10 border border-white/5 transition-colors overflow-hidden">
                        {classPreviewThumbnails[stat.id] ? (
                          <img src={classPreviewThumbnails[stat.id]} alt={stat.name} className="w-12 h-12 rounded-lg object-cover p-2" />
                        ) : (
                          <div className="w-12 h-12 flex items-center justify-center text-xl bg-zinc-900 rounded-lg">📦</div>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="block text-2xl font-bold text-white leading-none mb-1">{stat.count}</span>
                        <span className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">{stat.percentage}%</span>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <h3 className="text-sm font-bold text-zinc-200 truncate">{stat.name}</h3>
                      <div className="h-1.5 w-full bg-zinc-900 rounded-full overflow-hidden">
                        <div className="h-full bg-yellow-400 shadow-[0_0_10px_rgba(245,197,24,0.5)] transition-all duration-1000"
                          style={{ width: `${stat.percentage}%` }} />
                      </div>
                      <div className="flex gap-2">
                        <button className={`${btn} flex-1 justify-center py-2 text-[10px] border-white/5 hover:bg-zinc-800`}
                          onClick={() => viewClassCrops(stat.id, stat.name)} disabled={stat.count === 0}>
                          Inspect Crops
                        </button>
                        <button className="p-2 bg-red-500/5 border border-red-500/10 rounded-xl hover:bg-red-500/20 text-red-500 transition-all hover:border-red-500/50"
                          onClick={() => deleteClass(stat.id)} title="Delete Class">
                          🗑️
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="h-[400px] flex flex-col items-center justify-center text-center bg-zinc-950 border border-white/5 rounded-3xl border-dashed">
                <div className="text-4xl mb-4 opacity-20"></div>
                <p className="text-sm text-zinc-500">No annotation data available.</p>
              </div>
            )}

            {/* Table Fallback/Summary */}
            <div className="pt-12">
              <div className="bg-zinc-950 border border-white/5 rounded-3xl overflow-hidden shadow-2xl">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-900/50">
                      <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-white/5">Class Index</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-white/5">Label Name</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-white/5">Samples</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-white/5">Impact</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {classStats.map((stat) => (
                      <tr key={stat.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-6 py-4 text-xs font-mono text-zinc-600">#{stat.id.toString().padStart(2, '0')}</td>
                        <td className="px-6 py-4 text-xs font-bold text-zinc-200">{stat.name}</td>
                        <td className="px-6 py-4 text-xs font-semibold text-zinc-400">{stat.count}</td>
                        <td className="px-6 py-4">
                          <div className="flex items-center gap-3">
                            <div className="h-1 w-24 bg-zinc-900 rounded-full overflow-hidden">
                              <div className="h-full bg-yellow-400/50" style={{ width: `${stat.percentage}%` }} />
                            </div>
                            <span className="text-[10px] text-zinc-600">{stat.percentage}%</span>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </main>
      </div>

      <div className="h-[32px] bg-zinc-950 border-t border-white/5 px-6 flex items-center justify-between text-[10px] font-bold uppercase tracking-widest text-zinc-600">
        <span>Dashboard Active</span>
        <span>{totalAnnotations} annotations found across {totalImages} images</span>
      </div>

      {/* ── Crop Viewer Modal ── */}
      {showCropViewer && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12 animate-in" onClick={closeCropViewer}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" />

          <div className="relative w-full max-w-7xl h-full bg-zinc-950 border border-white/10 rounded-[32px] shadow-[0_0_80px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}>

            {/* Modal Header */}
            <header className="flex items-center justify-between px-8 py-6 border-b border-white/10 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-20">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-2xl shadow-inner">📸</div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-white leading-none mb-1.5">Annotation Crops: {selectedClassForCrops?.name}</h2>
                  <p className="text-xs text-zinc-500 font-medium">Verify and manage individual labels for this class</p>
                </div>
              </div>
              <button className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-red-500/10 hover:border-red-500/30 hover:text-red-500 transition-all font-mono"
                onClick={closeCropViewer}>✕</button>
            </header>

            <div className="flex flex-1 overflow-hidden">
              {/* Main Grid Area */}
              <div className="flex-1 flex flex-col min-w-0">
                {/* Sub-Header: Controls */}
                <div className="px-8 py-4 bg-zinc-900/30 border-b border-white/5 flex flex-wrap items-center gap-4">
                  <button className={`${btn} ${isSelectionMode ? "bg-yellow-400/20 border-yellow-400/50 text-yellow-300" : ""}`} onClick={toggleSelectionMode}>
                    {isSelectionMode ? "✓ Selection Mode ON" : "Enable Multi-Select"}
                  </button>

                  {isSelectionMode && (
                    <div className="flex items-center gap-2 animate-in">
                      <button className={btn} onClick={selectAllOnPage}>Select All Page</button>
                      <button className={btn} onClick={deselectAll}>Deselect</button>
                      <div className="w-px h-4 bg-white/10 mx-2" />
                      <span className="text-xs font-bold text-yellow-400">{selectedLabels.size} selected</span>

                      {selectedLabels.size > 0 && (
                        <div className="flex items-center gap-3 ml-4 pl-4 border-l border-white/10">
                          <label className="text-[10px] font-bold text-zinc-500 uppercase tracking-widest">Bulk Actions:</label>
                          <div className="w-48">
                            <SearchableDropdown options={classes} value={bulkSearchTerm}
                              onChange={(val) => { bulkChangeClass(classes.indexOf(val)); setBulkSearchTerm(""); }}
                              placeholder="Re-classify..." />
                          </div>
                          <button className={`${btn} border-red-500/30 text-red-500 hover:bg-red-500/10`} onClick={bulkDeleteCrops}>
                            🗑️ Delete {selectedLabels.size}
                          </button>
                        </div>
                      )}
                    </div>
                  )}

                  <div className="ml-auto flex items-center gap-4">
                    <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">
                      Page {currentPage} / {Math.max(1, Math.ceil(totalCrops / itemsPerPage))}
                    </span>
                    <div className="flex gap-1">
                      <button className="p-2 bg-zinc-900 border border-white/5 rounded-lg hover:border-white/20 disabled:opacity-20"
                        onClick={() => loadPage(currentPage - 1)} disabled={currentPage === 1}>←</button>
                      <button className="p-2 bg-zinc-900 border border-white/5 rounded-lg hover:border-white/20 disabled:opacity-20"
                        onClick={() => loadPage(currentPage + 1)} disabled={currentPage >= Math.ceil(totalCrops / itemsPerPage)}>→</button>
                    </div>
                  </div>
                </div>

                {/* The Grid */}
                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-6">
                    {classCrops.map((crop) => {
                      const isSelected = selectedLabels.has(crop.id);
                      return (
                        <div key={crop.id} className={`group relative rounded-2xl overflow-hidden border transition-all duration-300 ${isSelected ? "border-yellow-400 ring-2 ring-yellow-400/20 bg-yellow-400/5 shadow-2xl" : "border-white/5 bg-zinc-900 shadow-lg hover:border-white/20"
                          }`}>
                          {/* Overlay Checkbox */}
                          {isSelectionMode && (
                            <div className="absolute top-3 left-3 z-10">
                              <div className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${isSelected ? "bg-yellow-400 border-yellow-400" : "bg-black/30 border-white/20"
                                }`} onClick={() => toggleCropSelection(crop.id)}>
                                {isSelected && <span className="text-white text-[10px]">✓</span>}
                              </div>
                            </div>
                          )}

                          {/* Image Preview */}
                          <div className="aspect-square bg-zinc-950 flex items-center justify-center overflow-hidden cursor-pointer p-2"
                            onClick={() => isSelectionMode && toggleCropSelection(crop.id)}>
                            <img src={crop.cropSrc} alt="Crop" className="max-w-full max-h-full object-contain group-hover:scale-105 transition-transform duration-500" />
                          </div>

                          {/* Crop Info Foot */}
                          <div className="p-3 bg-zinc-950/80 backdrop-blur-md border-t border-white/5">
                            <p className="text-[10px] font-mono text-zinc-400 truncate mb-2">{crop.imageName}</p>

                            {!isSelectionMode && (
                              <div className="flex items-center gap-2">
                                <select className="flex-1 bg-zinc-900 border border-white/10 rounded-lg py-1 px-2 text-[10px] text-zinc-300 outline-none focus:border-yellow-400/50"
                                  value={crop.annotation.classId} onChange={(e) => changeAnnotationClass(crop.imageIndex, crop.annotationIndex, e.target.value)}>
                                  {classes.map((cls, idx) => <option key={idx} value={idx}>{cls}</option>)}
                                </select>
                                <button className="w-8 h-8 flex items-center justify-center bg-red-500/5 border border-red-500/10 rounded-lg text-red-500 hover:bg-red-500/20"
                                  onClick={() => removeAnnotationAndImageFromFile(crop.imageIndex, crop.annotationIndex)}>🗑️</button>
                              </div>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>

              {/* Right Side: Class Reference */}
              <aside className="w-[300px] border-l border-white/5 bg-zinc-900/40 backdrop-blur-2xl flex flex-col">
                <div className="p-6 border-b border-white/10">
                  <h3 className="text-xs font-bold text-white uppercase tracking-widest mb-1">Class Library</h3>
                  <p className="text-[10px] text-zinc-500">Quickly switch between label views</p>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
                  {classes.map((cls, idx) => (
                    <div key={idx} onClick={() => viewClassCrops(idx, cls)}
                      className={`group flex items-center gap-3 p-3 rounded-2xl border transition-all cursor-pointer ${selectedClassForCrops?.name === cls
                          ? "bg-yellow-400/10 border-yellow-400/30 ring-1 ring-yellow-400/20"
                          : "bg-transparent border-transparent hover:bg-white/5"
                        }`}>
                      <div className="w-12 h-12 rounded-xl bg-zinc-900 border border-white/5 overflow-hidden flex-shrink-0 flex items-center justify-center">
                        {classPreviewThumbnails[idx] ? (
                          <img src={classPreviewThumbnails[idx]} alt={cls} className="w-full h-full object-cover opacity-80 group-hover:opacity-100 p-1" />
                        ) : (
                          <span className="text-xs opacity-20">📷</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`text-[11px] font-bold truncate ${selectedClassForCrops?.name === cls ? "text-yellow-300" : "text-zinc-400 group-hover:text-zinc-200"}`}>
                          {cls}
                        </p>
                        <p className="text-[10px] text-zinc-600 font-mono">#{idx.toString().padStart(2, '0')}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 border-t border-white/10">
                  <AddClass setNewClassName={setNewClassName} addNewClass={handleAddNewClassFromDashboard} newClassName={newClassName} />
                </div>
              </aside>
            </div>
          </div>
        </div>
      )}

      {/* ── Class Report Modal ── */}
      {showReportModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-6 sm:p-12 animate-in" onClick={() => setShowReportModal(false)}>
          <div className="absolute inset-0 bg-black/80 backdrop-blur-xl" />

          <div className="relative w-full max-w-4xl max-h-[90vh] bg-zinc-950 border border-white/10 rounded-[32px] shadow-[0_0_80px_rgba(0,0,0,0.8)] flex flex-col overflow-hidden"
            onClick={(e) => e.stopPropagation()}>

            <header className="flex items-center justify-between px-8 py-6 border-b border-white/10 bg-zinc-950/50 backdrop-blur-md sticky top-0 z-20">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-2xl bg-yellow-400/10 border border-yellow-400/20 flex items-center justify-center text-2xl shadow-inner">📜</div>
                <div>
                  <h2 className="text-xl font-bold tracking-tight text-white leading-none mb-1.5">Dataset Health Report</h2>
                  <p className="text-xs text-zinc-500 font-medium">Detailed metrics per classification unit</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <button className={btnPrimary} onClick={downloadReportCSV}>Download CSV</button>
                <button className="w-10 h-10 rounded-full border border-white/10 flex items-center justify-center hover:bg-white/10 transition-all font-mono"
                  onClick={() => setShowReportModal(false)}>✕</button>
              </div>
            </header>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6">
              <div className="bg-zinc-950 border border-white/5 rounded-2xl overflow-hidden">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-zinc-900/50">
                      <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-white/5">Label Name</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-white/5 text-center">Annotations</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-white/5 text-center">Rel. Density</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-white/5 text-center">Status</th>
                      <th className="px-6 py-4 text-[10px] font-bold text-zinc-500 uppercase tracking-widest border-b border-white/5 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-white/5">
                    {classReportData.map((stat) => (
                      <tr key={stat.id} className="hover:bg-white/[0.02] transition-colors group">
                        <td className="px-6 py-4">
                          <p className="text-xs font-bold text-white mb-0.5">{stat.name}</p>
                          <p className="text-[10px] text-zinc-500 font-mono italic">Seen in {stat.imageCount} images</p>
                        </td>
                        <td className="px-6 py-4 text-center text-xs font-semibold text-zinc-300">{stat.annotationCount}</td>
                        <td className="px-6 py-4 text-center text-xs font-mono text-yellow-400">{stat.density} <span className="text-[10px] text-zinc-600">avg</span></td>
                        <td className="px-6 py-4 text-center">
                          {stat.annotationCount === 0 ? (
                            <span className="px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-[10px] text-red-500 font-bold uppercase tracking-tight">Empty</span>
                          ) : stat.annotationCount < 10 ? (
                            <span className="px-2 py-0.5 rounded-full bg-orange-500/10 border border-orange-500/20 text-[10px] text-orange-500 font-bold uppercase tracking-tight">Low Samples</span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] text-emerald-500 font-bold uppercase tracking-tight">Healthy</span>
                          )}
                        </td>
                        <td className="px-6 py-4 text-right">
                          <button className={`${btn} py-1 text-[10px]`} onClick={() => { setShowReportModal(false); viewClassCrops(stat.id, stat.name); }}>
                            View Crops
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Smart Sort Modal ── */}
      {showSmartSortModal && smartSortCurrentCrop && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center p-6 animate-in">
          <div className="absolute inset-0 bg-black/90 backdrop-blur-3xl" />

          <div className="relative w-full max-w-4xl h-[600px] bg-zinc-950 border border-white/10 rounded-[40px] shadow-[0_0_120px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden">
            <header className="px-10 py-8 border-b border-white/10 flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="text-3xl"></div>
                <div>
                  <h2 className="text-xl font-bold text-white tracking-tight leading-none mb-1">Smart Sort Assistant</h2>
                  <p className="text-xs text-zinc-500">AI-driven classification suggesting label corrections</p>
                </div>
              </div>
              <button className="px-4 py-2 bg-red-500/10 border border-red-500/20 text-red-500 text-[10px] font-bold uppercase tracking-widest rounded-xl hover:bg-red-500/20 transition-all"
                onClick={() => { setIsSmartSorting(false); setShowSmartSortModal(false); viewClassCrops(selectedClassForCrops.id, selectedClassForCrops.name); }}>
                Stop Sorting
              </button>
            </header>

            <div className="flex flex-1 overflow-hidden">
              {/* Left: The Subject */}
              <div className="w-[400px] p-10 border-r border-white/10 flex flex-col items-center justify-center bg-zinc-950/50">
                <div className="relative group">
                  <div className="absolute -inset-4 bg-yellow-400/20 rounded-[40px] blur-2xl opacity-50 group-hover:opacity-100 transition-opacity" />
                  <img src={smartSortCurrentCrop.cropSrc} alt="Subject" className="relative h-48 w-48 object-contain rounded-3xl border-4 border-white/10 shadow-2xl bg-black" />
                </div>

                <div className="mt-8 w-full">
                  {smartSortSuggestion?.name ? (
                    <div className="bg-emerald-500/10 border border-emerald-500/20 rounded-3xl p-6 text-center animate-in">
                      <p className="text-[10px] font-bold text-emerald-500 uppercase tracking-[0.2em] mb-3">AI Suggestion</p>
                      <h4 className="text-2xl font-bold text-white mb-1">{smartSortSuggestion.name}</h4>
                      <p className="text-xs text-emerald-500/60 font-mono mb-6">{(smartSortSuggestion.confidence * 100).toFixed(1)}% Confidence</p>
                      <button className="w-full py-3 bg-emerald-500 hover:bg-emerald-400 text-black font-bold rounded-2xl transition-all shadow-xl shadow-emerald-500/20 active:scale-95"
                        onClick={() => handleSmartSortDecision(smartSortSuggestion.name)}>
                        Confirm Suggestion
                      </button>
                    </div>
                  ) : (
                    <div className="bg-zinc-900/50 border border-white/5 rounded-3xl p-6 text-center italic text-zinc-500 text-sm">
                      No confident match found.
                    </div>
                  )}
                </div>
              </div>

              {/* Right: Manual Decisions */}
              <div className="flex-1 flex flex-col min-w-0">
                <div className="p-8 pb-4 border-b border-white/10">
                  <label className={labelCls}>Assign New Class</label>
                  <div className="flex gap-2">
                    <input type="text" placeholder="Enter custom label..." value={smartSortNewClassInput} onChange={(e) => setSmartSortNewClassInput(e.target.value)} className={inputCls} />
                    <button className={btnPrimary} disabled={!smartSortNewClassInput.trim()} onClick={() => handleSmartSortDecision(smartSortNewClassInput.trim())}>Create</button>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto p-8 custom-scrollbar">
                  <label className={labelCls}>Select from Existing</label>
                  <div className="grid grid-cols-1 gap-2">
                    <button className="w-full py-4 px-6 bg-zinc-900 border border-white/5 rounded-2xl text-left text-zinc-500 hover:bg-zinc-800 transition-all text-sm font-bold mb-4"
                      onClick={() => { processNextSmartSortCrop(smartSortCurrentCrop.index + 1); setShowSmartSortModal(false); }}>
                      Skip this crop for now
                    </button>

                    {classes.map((cls, idx) => (
                      <button key={idx} onClick={() => handleSmartSortDecision(cls)}
                        className="group flex items-center gap-4 p-3 rounded-2xl border border-white/5 bg-zinc-900/30 hover:bg-zinc-800/80 hover:border-white/20 transition-all">
                        <div className="w-10 h-10 rounded-xl overflow-hidden bg-black flex-shrink-0 flex items-center justify-center border border-white/5">
                          {classPreviewThumbnails[idx] ? (
                            <img src={classPreviewThumbnails[idx]} alt={cls} className="w-full h-full object-cover opacity-70 group-hover:opacity-100" />
                          ) : (<span className="text-xs opacity-20">📷</span>)}
                        </div>
                        <span className="flex-1 text-left text-xs font-bold text-zinc-400 group-hover:text-white transition-colors">{cls}</span>
                        <span className="text-[10px] font-mono text-zinc-600 opacity-0 group-hover:opacity-100 transition-opacity">Assign →</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Dashboard;
