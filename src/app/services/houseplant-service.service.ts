import { Injectable, inject } from '@angular/core';
import { Timestamp, query, orderBy, where, addDoc, deleteDoc, getDoc, getDocs, setDoc, updateDoc, Firestore, doc, collection, collectionData, CollectionReference } from '@angular/fire/firestore';
import { User, Auth, getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, onAuthStateChanged } from "@angular/fire/auth";
import { Observable, firstValueFrom,map,BehaviorSubject, combineLatest } from 'rxjs';
import { Router } from '@angular/router';
import { MqttMessage, MqttService } from './mqtt.service';


export interface Account {
  ownedPlants: string[];
  email: string;
}

export interface Plant {
  id: string;
  name: string;
  minimumMoisture: number; // determines when the plant needs watering
  waterVolume: number; // amount of water to be dispensed in mL
  waterLog: Timestamp[];
  moistureLog: {Timestamp: Timestamp, number: number} []; // tracks the moisture levels over time
  temperatureLog: {Timestamp: Timestamp, number: number}[]; // tracks the temperature levels over time
  lightLog: Timestamp[]; // tracks when the light levels were above a certain threshold (0)
  plantImage: string // base64 image of the plant
}

@Injectable({
  providedIn: 'root',
})
export class houseplantService {
  firestore: Firestore = inject(Firestore);
  router: Router = inject(Router)
  auth: Auth = getAuth();
  user: User | null = null;
  currentAccount: Account | null = null;
  plantCollection: CollectionReference;
  public plants$: Observable<Plant[]>; 
  public ownedPlantsData: Plant[] = [];
  accountCollection: CollectionReference;
  public accounts$: Observable<Account[]>;
  public mqttService: MqttService = inject(MqttService); // Inject the MqttService
  
  constructor() {
    // Fetch all accounts from Firestore
    this.accountCollection = collection(this.firestore, 'Accounts');
    const accountConverter = {
      toFirestore: (account: Account) => account,
      fromFirestore: (snapshot: any) => {
        const data = snapshot.data();
        return {
          ownedPlants: data.ownedPlants || [],
          email: data.email,
        } as Account;
      },
    };

    // Create a proper query
    const accountsQuery = query(collection(this.firestore, 'Accounts').withConverter(accountConverter));
    this.accounts$ = collectionData<Account>(accountsQuery);

    // Fetch all plants from Firestore
    this.plantCollection = collection(this.firestore, 'Plants');
    const plantConverter = {
      toFirestore: (plant: Plant) => plant,
      fromFirestore: (snapshot: any) => {
        const data = snapshot.data();
        return {
          id: data.id,
          name: data.name,
          minimumMoisture: data.minimumMoisture,
          waterVolume: data.waterVolume,
          waterLog: data.waterLog,
          lightLog: data.lightLog,
        } as Plant;
      },
    };

    // Create a proper query for plants
    const plantsQuery = query(collection(this.firestore, 'Plants').withConverter(plantConverter));
    this.plants$ = collectionData<Plant>(plantsQuery);
 

    // Listen for auth state changes and set the user property
    onAuthStateChanged(this.auth, (currentUser) => {
      this.user = currentUser;
      console.log('Auth state changed, user is now:', this.user);
      if (this.user && this.user.email) {
        // Fetch the current account based on the logged-in user
        this.fetchAccount(this.user.email).then(async (account) => { // user logged in
          this.currentAccount = account;            
          // Fetch plants for the current account
          const plants = await this.fetchAccountPlants();
          this.ownedPlantsData = plants;
          console.log('Owned plants data:', this.ownedPlantsData);

          // Only subscribe to MQTT topics after we have the plant data
          this.subscribeToPlantData();

          // Listen for incoming messages
          this.mqttService.messages$.subscribe((message) => {
            if (!message) return; // Ignore null messages
            // console.log(message.topic, ' received MQTT message:', message.payload);
            this.handleMqttMessage(message);
          });

          // Monitor + Publish instructions to maintain plant conditions
          setInterval(() => this.monitorPlantConditions(), 3000);
        });
      } else {
        this.currentAccount = null;
      }
    });
  }  
  
  async addPlant(newPlant: Partial<Plant>, imageFile?: File): Promise<string> {
    try {

      // handles if the user inputs an image file
      let plantImage = '';
      if (imageFile) {
          plantImage = await this.convertImageToBase64(imageFile);
      }

      const plantDocRef = doc(this.plantCollection);
      const id = plantDocRef.id;

      await setDoc(plantDocRef, {
          ...newPlant,
          id,
          plantImage
      });
  
      console.log('Plant successfully added with ID:', id);
  
      // update the owner's 'ownedPlants' field in their account document
      if (this.currentAccount) {  
        const accountsQuery = query(
          collection(this.firestore, 'Accounts'),
          where('email', '==', this.currentAccount.email)
        );
      
        const querySnapshot = await getDocs(accountsQuery);
      
        if (querySnapshot.empty) {
          throw new Error(`No account found with email: ${this.currentAccount.email}`);
        }
      
        const accountDocRef = querySnapshot.docs[0].ref;
      
        // Update the 'ownedPlants' array by adding the new plant ID
        await updateDoc(accountDocRef, {
          ownedPlants: [...this.currentAccount.ownedPlants, id],
        });
      
        console.log("Owner's 'ownedPlants' updated successfully");

        // Update the local `currentAccount` to reflect the change
        this.currentAccount = {
          ...this.currentAccount,
          ownedPlants: [...this.currentAccount.ownedPlants, id],
        };

        console.log('Local currentAccount updated successfully');
      }
      return id;
    } catch (error) {
      console.error('Error adding plant:', error);
    }
    return "Failed to add plant";
  }
  

  async updatePlant(plantId: string, updates: Partial<Plant>): Promise<void> {
    try {
      // Reference the specific plant document by its ID
      const plantDocRef = doc(this.firestore, 'Plants', plantId);
  
      // Check if the plant document exists
      const plantSnap = await getDoc(plantDocRef);
      if (!plantSnap.exists()) {
        throw new Error(`Plant with ID ${plantId} does not exist`);
      }
  
      // Update the plant document with the provided updates
      await updateDoc(plantDocRef, updates);

      // Update the local `ownedPlantsData` to reflect the changes
      const plantIndex = this.ownedPlantsData.findIndex(plant => plant.id === plantId);
      if (plantIndex !== -1) {
        this.ownedPlantsData[plantIndex] = { ...this.ownedPlantsData[plantIndex], ...updates };
      } else {
        console.error(`Plant with ID ${plantId} not found in local data`);
      }
    } catch (error) {
      console.error('Error updating plant:', error);
      throw error;
    }
  }

  async deletePlant(plantId: string): Promise<void> {
    try {
      if (!this.currentAccount) {
        throw new Error('No current account is logged in');
      }
  
      // Delete the plant from the "Plants" collection
      const plantDocRef = doc(this.firestore, 'Plants', plantId);
      await deleteDoc(plantDocRef);
      console.log(`Plant with ID ${plantId} deleted successfully.`);
  
      // Query the "Accounts" collection to find the current user's document
      const accountsQuery = query(
        collection(this.firestore, 'Accounts'),
        where('email', '==', this.currentAccount.email)
      );
      const querySnapshot = await getDocs(accountsQuery);

      if (querySnapshot.empty) {
        throw new Error(`No account found with email: ${this.currentAccount.email}`);
      }
      const accountDocRef = querySnapshot.docs[0].ref;

      // Remove the plant's ID from the owner's "ownedPlants" array
      const updatedOwnedPlants = this.currentAccount.ownedPlants.filter(id => id !== plantId);
      await updateDoc(accountDocRef, { ownedPlants: updatedOwnedPlants });
      console.log(`Owner's ownedPlants updated successfully after deleting plant ${plantId}`);

      // Update the local `currentAccount` to reflect the deletion
      this.currentAccount = {
        ...this.currentAccount,
        ownedPlants: updatedOwnedPlants,
      };
      console.log('Local currentAccount updated successfully');
    } catch (error) {
      console.error('Error deleting plant:', error);
      throw error;
    }
  }

  async fetchAccountPlants(): Promise<Plant[]> {
    try {
      if (!this.currentAccount) {
        throw new Error('No current account is logged in');
      }
      
      const ownedPlantIds = this.currentAccount.ownedPlants;
      
      if (ownedPlantIds.length === 0) {
        return [];
      }
      
      // Modified query to use individual document references
      const plants: Plant[] = [];
      for (const plantId of ownedPlantIds) {
        const plantDoc = await getDoc(doc(this.firestore, 'Plants', plantId));
        if (plantDoc.exists()) {
          plants.push({ id: plantDoc.id, ...plantDoc.data() } as Plant);
        }
      }
      return plants;
    } catch (error) {
      console.error('Error fetching account plants:', error);
      throw error;
    }
  }

  subscribeToPlantData(): void {
    // subscribes to the MQTT topic for all plants owned by the current account
    console.log('Subscribing to MQTT topics for owned plants...');
    for (let i = 0; i < this.ownedPlantsData.length; i++) {
      const plant = this.ownedPlantsData[i];
      console.log(`Subscribing to MQTT topic for plant: ${plant.name} (cs326/plantMonitor/${plant.name}/out)`);
      // subscribes to the plants associated topics
      this.mqttService.subscribe(`cs326/plantMonitor/${plant.name}/out/moisture`);
      this.mqttService.subscribe(`cs326/plantMonitor/${plant.name}/out/light`);
      this.mqttService.subscribe(`cs326/plantMonitor/${plant.name}/out/temperature`);
      this.mqttService.subscribe(`cs326/plantMonitor/${plant.name}/out/time`);
    }
  }

  private handleMqttMessage(message: MqttMessage) {
    // responsible for handling incomming MQTT messages from broker
    try {
      // parses message topic into array, ex <class>/<project>/<plant name>/out/<data type>      
      const topicParts = message.topic.split('/');
      const plantName = topicParts[2]; // Extract the plant name from the topic
      const dataType = topicParts[4]; // Extract the data type from the topic

      // Find the plant in the ownedPlantsData array
      const plant = this.ownedPlantsData.find(p => p.name === plantName);
      if (!plant) {
        console.error(`Plant with name ${plantName} not found in owned plants`);
        return;
      }

      console.log(`Received ${dataType} data for ${plantName}:`, message.payload);

      // updates the plants data both locally and in the database
      const time = new Timestamp(Date.now()/1000, 0);
      switch (dataType) {
        case 'moisture':
          // new moisture data is added to the moistureLog array
          const moisture: number = parseFloat(message.payload);
          plant.moistureLog.push({Timestamp: time, number: moisture});
          this.updatePlant(plant.id, { moistureLog: plant.moistureLog,  });
          break;
        case 'light':
          const lightLevel = (parseInt(message.payload));
          if (lightLevel > 0) { // If light level is above 0, add a timestamp to the lightLog    
            plant.lightLog.push(new Timestamp(Date.now()/1000, 0));
            this.updatePlant(plant.id, { lightLog: plant.lightLog });
          }
          break;
        case 'temperature':
          const temperature: number = parseFloat(message.payload);
          plant.temperatureLog.push({Timestamp: time, number: temperature});
          this.updatePlant(plant.id, { temperatureLog: plant.temperatureLog });
          break;
        default:
          console.error(`Unknown data type: ${dataType}`);
      }
    } catch (error) {
      console.error('Error parsing MQTT message:', error);
    }
  }

  private async monitorPlantConditions(): Promise<void> {
    try {
      if (!this.currentAccount) {
        console.warn('No logged-in user, skipping plant monitoring.');
        return;
      }
  
      // Fetch latest plant data
      const plants = await this.fetchAccountPlants();
  
      console.log('Plants to monitor:', plants);
      for (const plant of plants) {
        // Check if the plant has moisture readings
        if (plant.moistureLog && plant.moistureLog.length > 0) {
            // Get the latest moisture reading
            const latestMoisture = plant.moistureLog[plant.moistureLog.length - 1];
            
            // Check if moisture is below threshold
            const lastWateringTime = plant.waterLog[plant.waterLog.length-1]; // gets the last watering time
            const currentTime = new Timestamp(Date.now()/1000, 0); // gets the current time
            const timeDifference = currentTime.seconds - lastWateringTime.seconds; // calculates the time difference in seconds
            if (latestMoisture.number < plant.minimumMoisture && timeDifference > 600) {
                console.log(`${plant.name} needs water! Current moisture: ${latestMoisture.number}%, Minimum: ${plant.minimumMoisture}%`);
                // Publish MQTT command to water the plant
                await this.waterPlant(plant.id);
            }
        } else {
            console.log(`No moisture data available for plant: ${plant.name}`);
        }
    }
    } catch (error) {
      console.error('Error monitoring plant conditions:', error);
    }
  }

  public async waterPlant(id: string): Promise<void> {
    // finds the plant's water volume from the plants array
    const plant = this.ownedPlantsData.find(p => p.id === id);

    if (!plant) {
      console.error(`Plant with ID ${id} not found`);
      return;
    }

    // Publish the command to the MQTT broker to water the plant
    this.mqttService.publish(`cs326/plantMonitor/${plant.name}/in`, `pump_on_${plant.waterVolume}`);
    console.log(`Published command to water ${plant.name} with volume ${plant.waterVolume}`);

    // Add the current timestamp to the waterLog array
    const time = new Timestamp(Date.now()/1000, 0);
    plant.waterLog.push(time);
    // Update the plant's waterLog in Firestore
    await this.updatePlant(plant.id, { waterLog: plant.waterLog });
  }

  public async fetchPlantByID(id: string): Promise<Plant | null> {
    try {
      const plantDocRef = doc(this.firestore, 'Plants', id);
      const plantDoc = await getDoc(plantDocRef);
      if (plantDoc.exists()) {
        const data = plantDoc.data();
            return {
                id: plantDoc.id,
                name: data['name'] || '',
                minimumMoisture: data['minimumMoisture'] || 0,
                waterVolume: data['waterVolume'] || 0,
                waterLog: data['waterLog'] || [],
                moistureLog: data['moistureLog'] || [],
                temperatureLog: data['temperatureLog'] || [],
                lightLog: data['lightLog'] || []
            } as Plant;        
      } else {
        console.error(`No plant found with ID ${id}`);
        return null;
      }
    }
    catch (error) {
      console.error('Error fetching plant:', error);
      return null;
    }
  }

  //Creates the user for authentication, then calls createAccount to update the database
  async createUser(email: string, password: string, newAccount: Account): Promise<void> {
    console.log('Creating user with email:', email);
    createUserWithEmailAndPassword(this.auth, email, password)
      .then((userCredential) => {
        // Signed up 
        this.user = userCredential.user;
        console.log('User successfully created:', this.user);
        this._createAccount(newAccount);
      })
      .catch((error) => {
        const errorCode = error.code;
        const errorMessage = error.message;
        console.log(errorCode, errorMessage);
      });
  }

  // creates the account document
  async _createAccount(account: Account): Promise<void> {
    try {
      const docRef = await addDoc(this.accountCollection, account);
      console.log('Account created with ID:', docRef.id);
    } catch (error) {
      console.error('Error creating account:', error);
      throw error;
    }
  }  

  async fetchAccount(email: string): Promise<Account> {
    // Create a proper query to find account by email
    const accountsQuery = query(
      collection(this.firestore, 'Accounts'),
      where('email', '==', email)
    );

    const querySnapshot = await getDocs(accountsQuery);

    if (querySnapshot.empty) {
      throw new Error(`Account with email ${email} not found`);
    }

    // Get the first (and should be only) matching document
    const accountData = querySnapshot.docs[0].data() as Account;
    return accountData;
  }  

  async login (email: string, password: string): Promise<boolean> {
    try {
      const userCredential = await signInWithEmailAndPassword(this.auth, email, password);
      this.user = userCredential.user;
      console.log('User logged in:', this.user);
      this.currentAccount = await this.fetchAccount(email)
      return true;  // Return true on successful login
    } catch (error) {
      // Handle case where the error isn't an instance of Error
      console.log(error);
      return false;
    }
  }

  async logout(): Promise<void>{
    // Sign out from Firebase Auth
    await signOut(this.auth);
    console.log('User logged out from Firebase');

    // Clear user data
    this.user = null;
    this.currentAccount = null;
    this.ownedPlantsData = [];

    // Clear MQTT subscriptions for each plant
    if (this.ownedPlantsData) {
      for (const plant of this.ownedPlantsData) {
        this.mqttService.unsubscribe(`cs326/plantMonitor/${plant.name}/out`);
      }
    }
    
    // Navigate to home page
    await this.router.navigate(['/']);
  }

  async convertImageToBase64(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
            const base64String = reader.result as string;
            resolve(base64String);
        };
        reader.onerror = (error) => reject(error);
        reader.readAsDataURL(file);
    });
}
}
