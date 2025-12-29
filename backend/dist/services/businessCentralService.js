"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.getProjects = getProjects;
exports.getPurchaseInvoicesByProject = getPurchaseInvoicesByProject;
const axios_1 = __importDefault(require("axios"));
const BC_ENVIRONMENT_ID = '9f4e2976-b07e-4f8f-9c78-055f6c855a11';
const BC_COMPANY = "ARK%20Group%20Live";
const BC_BASE_URL = `https://api.businesscentral.dynamics.com/v2.0/${BC_ENVIRONMENT_ID}/Production/ODataV4/Company('${BC_COMPANY}')`;
/**
 * Fetch projects from Business Central Project_Card_Excel
 */
async function getProjects(accessToken) {
    try {
        const url = `${BC_BASE_URL}/Project_Card_Excel`;
        const response = await axios_1.default.get(url, {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
        });
        // Extract and map the data
        const projects = response.data.value.map((project) => ({
            no: project.No,
            name: project.Name || project.No,
        }));
        console.log(`✅ Fetched ${projects.length} projects from BC`);
        return projects;
    }
    catch (error) {
        console.error('❌ Error fetching projects from BC:', error.message);
        throw new Error(`Failed to fetch projects: ${error.message}`);
    }
}
/**
 * Fetch purchase invoices for a specific project
 */
async function getPurchaseInvoicesByProject(accessToken, projectNo, fromDate, toDate) {
    try {
        let url = `${BC_BASE_URL}/Purch_Inv_Header`;
        // Build filter for project number
        let filters = [`Job_No eq '${projectNo}'`];
        if (fromDate) {
            filters.push(`Posting_Date ge ${new Date(fromDate).toISOString().split('T')[0]}`);
        }
        if (toDate) {
            filters.push(`Posting_Date le ${new Date(toDate).toISOString().split('T')[0]}`);
        }
        if (filters.length > 0) {
            url += `?$filter=${filters.join(' and ')}`;
        }
        const response = await axios_1.default.get(url, {
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${accessToken}`,
            },
        });
        console.log(`✅ Fetched ${response.data.value.length} invoices for project ${projectNo}`);
        return response.data.value || [];
    }
    catch (error) {
        console.error(`❌ Error fetching invoices for project ${projectNo}:`, error.message);
        throw new Error(`Failed to fetch invoices: ${error.message}`);
    }
}
