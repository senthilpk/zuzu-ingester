#!/bin/bash

# ZUZU Ingester API Test Script
# This script tests the process-file API endpoint

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
API_BASE_URL="http://localhost:3000"
API_ENDPOINT="/api/processing/process-file"

# S3 Configuration (update these with your actual values)
S3_BUCKET="zuzu-inbox"
S3_REGION="<provide your region>"
S3_ACCESS_KEY="<provide your access key>"
S3_SECRET_KEY="<provide your secret key>"

# Sample file paths
LOCAL_FILE="data/agoda_com_2025-04-10.jl"
S3_FILE="agoda/agoda_com_2025-04-10.jl"

# Function to print colored output
print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to check if API is running
check_api_health() {
    print_status "Checking API health..."
    
    if curl -s -f "${API_BASE_URL}/api/health" > /dev/null; then
        print_success "API is running and healthy"
        return 0
    else
        print_error "API is not running or not accessible at ${API_BASE_URL}"
        print_warning "Make sure to start the API first with: bun run dev"
        return 1
    fi
}

# Function to test local file processing
test_local_file() {
    print_status "Testing local file processing..."
    
    if [ ! -f "$LOCAL_FILE" ]; then
        print_error "Local file not found: $LOCAL_FILE"
        return 1
    fi
    
    local response=$(curl -s -X POST "${API_BASE_URL}${API_ENDPOINT}" \
        -H "Content-Type: application/json" \
        -d "{
            \"filepath\": \"$LOCAL_FILE\",
            \"platform\": \"agoda\",
            \"storageProvider\": \"local\",
            \"options\": {
                \"storeToDatabase\": true,
                \"dbBatchSize\": 100,
                \"validateRecords\": true
            }
        }")
    
    if [ $? -eq 0 ]; then
        print_success "Local file processing request sent successfully"
        echo "Response: $response" | jq '.' 2>/dev/null || echo "Response: $response"
    else
        print_error "Failed to send local file processing request"
        return 1
    fi
}

# Function to test S3 file processing
test_s3_file() {
    print_status "Testing S3 file processing..."
    
    local response=$(curl -s -X POST "${API_BASE_URL}${API_ENDPOINT}" \
        -H "Content-Type: application/json" \
        -d "{
            \"filepath\": \"$S3_FILE\",
            \"platform\": \"agoda\",
            \"storageProvider\": \"s3\",
            \"options\": {
                \"storeToDatabase\": true,
                \"dbBatchSize\": 100,
                \"validateRecords\": true
            }
        }")
    
    if [ $? -eq 0 ]; then
        print_success "S3 file processing request sent successfully"
        echo "Response: $response" | jq '.' 2>/dev/null || echo "Response: $response"
    else
        print_error "Failed to send S3 file processing request"
        return 1
    fi
}

# Function to get job status
get_job_status() {
    local job_id=$1
    
    if [ -z "$job_id" ]; then
        print_warning "No job ID provided for status check"
        return 1
    fi
    
    print_status "Getting job status for: $job_id"
    
    local response=$(curl -s -X GET "${API_BASE_URL}/api/processing/jobs/${job_id}")
    
    if [ $? -eq 0 ]; then
        print_success "Job status retrieved successfully"
        echo "Response: $response" | jq '.' 2>/dev/null || echo "Response: $response"
    else
        print_error "Failed to get job status"
        return 1
    fi
}

# Function to list all jobs
list_jobs() {
    print_status "Listing all processing jobs..."
    
    local response=$(curl -s -X GET "${API_BASE_URL}/api/processing/jobs")
    
    if [ $? -eq 0 ]; then
        print_success "Jobs list retrieved successfully"
        echo "Response: $response" | jq '.' 2>/dev/null || echo "Response: $response"
    else
        print_error "Failed to get jobs list"
        return 1
    fi
}

# Function to show usage
show_usage() {
    echo "Usage: $0 [OPTION]"
    echo ""
    echo "Options:"
    echo "  health           Check API health"
    echo "  local            Test local file processing"
    echo "  s3               Test S3 file processing"
    echo "  status <job_id>  Get job status"
    echo "  jobs             List all jobs"
    echo "  all              Run all tests"
    echo "  help             Show this help message"
    echo ""
    echo "Examples:"
    echo "  $0 health"
    echo "  $0 local"
    echo "  $0 s3"
    echo "  $0 status job-abc123"
    echo "  $0 jobs"
    echo "  $0 all"
}

# Main script logic
main() {
    case "${1:-help}" in
        "health")
            check_api_health
            ;;
        "local")
            check_api_health && test_local_file
            ;;
        "s3")
            check_api_health && test_s3_file
            ;;
        "status")
            check_api_health && get_job_status "$2"
            ;;
        "jobs")
            check_api_health && list_jobs
            ;;
        "all")
            check_api_health && test_local_file && test_s3_file && list_jobs
            ;;
        "help"|*)
            show_usage
            ;;
    esac
}

# Run main function with all arguments
main "$@" 