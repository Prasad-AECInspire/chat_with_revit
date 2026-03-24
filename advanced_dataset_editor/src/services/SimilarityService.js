// src/services/SimilarityService.js
import * as tf from "@tensorflow/tfjs";
import * as mobilenet from "@tensorflow-models/mobilenet";

class SimilarityService {
  constructor() {
    this.model = null;
    this.isLoading = false;
  }

  // Load the MobileNet model
  async loadModel() {
    if (this.model) return this.model;
    if (this.isLoading) {
      // Wait if already loading
      return new Promise((resolve) => {
        const check = setInterval(() => {
          if (this.model) {
            clearInterval(check);
            resolve(this.model);
          }
        }, 100);
      });
    }

    this.isLoading = true;
    try {
      // Use efficient version of MobileNet
      this.model = await mobilenet.load({ version: 2, alpha: 1.0 });
      console.log("✅ MobileNet Model Loaded");
    } catch (error) {
      console.error("❌ Error loading MobileNet:", error);
      throw error;
    } finally {
      this.isLoading = false;
    }
    return this.model;
  }

  // Extract feature embedding from an image element
  async getEmbedding(imgElement) {
    if (!this.model) await this.loadModel();
    // 'infer' returns the intermediate activation (embedding)
    // true arg means we DON'T want the final classification layer, just embeddings
    const activation = this.model.infer(imgElement, true);
    return activation;
  }

  // Calculate Cosine Similarity between two tensors
  calculateSimilarity(tensorA, tensorB) {
    return tf.tidy(() => {
      // Flatten tensors to 1D vectors
      const vectorA = tensorA.flatten();
      const vectorB = tensorB.flatten();

      // Cosine Similarity = (A . B) / (||A|| * ||B||)
      const dotProduct = vectorA.dot(vectorB);
      const normA = vectorA.norm();
      const normB = vectorB.norm();

      const similarity = dotProduct.div(normA.mul(normB));
      return similarity.dataSync()[0];
    });
  }

  // Classify a crop against known class centroids
  // centroids = { "Cat": tensor, "Dog": tensor }
  async classifyCrop(imgElement, classCentroids, threshold = 0.85) {
    if (Object.keys(classCentroids).length === 0) {
      return null; // No existing classes to compare against
    }

    const cropEmbedding = await this.getEmbedding(imgElement);
    let bestMatch = null;
    let maxSimilarity = -1;

    for (const [className, centroid] of Object.entries(classCentroids)) {
      const similarity = this.calculateSimilarity(cropEmbedding, centroid);

      if (similarity > maxSimilarity) {
        maxSimilarity = similarity;
        bestMatch = className;
      }
    }

    // Clean up tensor memory
    // cropEmbedding.dispose(); // Wait, we might need this if we assign it!
    // Caller should handle disposal or we return it.

    if (maxSimilarity >= threshold) {
      return {
        match: bestMatch,
        similarity: maxSimilarity,
        embedding: cropEmbedding,
      };
    } else {
      return {
        match: null,
        similarity: maxSimilarity,
        embedding: cropEmbedding,
      };
    }
  }
}

export default new SimilarityService();
