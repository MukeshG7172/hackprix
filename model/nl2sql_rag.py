import os
import json
from typing import Dict, Any, List, Optional, Tuple
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
import pandas as pd
from langchain_community.llms import Ollama
from langchain_community.embeddings import OllamaEmbeddings
from langchain_community.vectorstores import Chroma
from langchain_community.document_loaders import TextLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.prompts import PromptTemplate
from langchain.schema import BaseOutputParser, Document
from langgraph.graph import Graph, StateGraph, END
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict, Annotated
import chromadb
from chromadb.config import Settings

# State definition for LangGraph with RAG
class NL2SQLRAGState(TypedDict):
    question: str
    sql_query: str
    query_result: List[Dict[str, Any]]
    final_answer: str
    error: Optional[str]
    context_docs: List[str]
    rag_context: str

class SQLQueryParser(BaseOutputParser):
    """Custom parser to extract SQL query from LLM response"""
    
    def parse(self, text: str) -> str:
        # Extract SQL query from the response
        text = text.strip()
        
        # Look for SQL query between backticks or SQL keywords
        if "```sql" in text.lower():
            start = text.lower().find("```sql") + 6
            end = text.find("```", start)
            if end != -1:
                return text[start:end].strip()
        elif "```" in text:
            start = text.find("```") + 3
            end = text.find("```", start)
            if end != -1:
                return text[start:end].strip()
        
        # Look for SELECT, INSERT, UPDATE, DELETE statements
        sql_keywords = ['SELECT', 'INSERT', 'UPDATE', 'DELETE']
        for keyword in sql_keywords:
            if keyword in text.upper():
                # Find the SQL statement
                lines = text.split('\n')
                sql_lines = []
                capturing = False
                for line in lines:
                    if any(kw in line.upper() for kw in sql_keywords):
                        capturing = True
                    if capturing:
                        sql_lines.append(line)
                        if line.strip().endswith(';'):
                            break
                return '\n'.join(sql_lines).strip()
        
        return text.strip()

class RAGManager:
    """Manages RAG functionality with ChromaDB"""
    
    def __init__(self, embedding_model: str = "nomic-embed-text:latest"):
        """Initialize RAG manager with ChromaDB"""
        self.embedding_model = embedding_model
        self.embeddings = OllamaEmbeddings(model=embedding_model)
        
        # Initialize ChromaDB client
        self.chroma_client = chromadb.PersistentClient(
            path="./chroma_db",
            settings=Settings(anonymized_telemetry=False)
        )
        
        # Initialize vector store
        self.vector_store = None
        self.initialize_knowledge_base()
    
    def initialize_knowledge_base(self):
        """Initialize the knowledge base with SQL and database documentation"""
        
        # Sample SQL knowledge base documents
        sql_knowledge = [
            """
            Common SQL Query Patterns for StudentRecord Table:
            
            1. Basic Selection:
            SELECT * FROM "StudentRecord" WHERE "department" = 'CSE';
            
            2. Aggregation Queries:
            SELECT AVG("leetcoderating") FROM "StudentRecord" WHERE "leetcoderating" > 0;
            SELECT COUNT(*) FROM "StudentRecord" GROUP BY "department";
            
            3. Top N Queries:
            SELECT * FROM "StudentRecord" ORDER BY "codeforcesrating" DESC LIMIT 5;
            
            4. Join and Complex Filters:
            SELECT "studentid", "department", "leetcoderating" 
            FROM "StudentRecord" 
            WHERE "leetcoderating" > 1500 AND "department" = 'CSE';
            """,
            
            """
            Database Schema Best Practices:
            
            Table: StudentRecord
            - Always use double quotes for table and column names
            - Platform enum values: 'LEETCODE', 'CODEFORCES', 'CODECHEF'
            - Date fields are TIMESTAMP WITH TIME ZONE
            - Rating fields are INTEGER (can be NULL)
            - Use proper WHERE clauses for filtering
            - Use ORDER BY for sorting results
            - Use LIMIT for restricting result count
            """,
            
            """
            Common Query Categories and Examples:
            
            1. Department-based queries:
            - "Show me all students from CSE department"
            SQL: SELECT * FROM "StudentRecord" WHERE "department" = 'CSE';
            
            2. Rating-based queries:
            - "What is the average LeetCode rating?"
            SQL: SELECT AVG("leetcoderating") FROM "StudentRecord" WHERE "leetcoderating" > 0;
            
            3. Top performers:
            - "Who has the highest Codeforces rating?"
            SQL: SELECT * FROM "StudentRecord" ORDER BY "codeforcesrating" DESC LIMIT 1;
            
            4. Contest participation:
            - "List students who participated in LEETCODE contests"
            SQL: SELECT DISTINCT "studentid", "leetcodeid" FROM "StudentRecord" WHERE "platform" = 'LEETCODE';
            """,
            
            """
            Error Handling and Common Issues:
            
            1. NULL values: Always check for NULL in rating fields
            Example: WHERE "leetcoderating" IS NOT NULL AND "leetcoderating" > 1000
            
            2. Platform enum: Use exact values 'LEETCODE', 'CODEFORCES', 'CODECHEF'
            
            3. Date queries: Use proper timestamp format
            Example: WHERE "contestdate" >= '2024-01-01'::timestamp
            
            4. Case sensitivity: Column names are case-sensitive, use double quotes
            
            5. Aggregation: Always handle division by zero in averages
            Example: CASE WHEN COUNT(*) > 0 THEN AVG("rating") ELSE 0 END
            """,
            
            """
            Advanced Query Patterns:
            
            1. Statistical Queries:
            SELECT 
                "department",
                COUNT(*) as student_count,
                AVG("leetcoderating") as avg_leetcode,
                MAX("codeforcesrating") as max_codeforces
            FROM "StudentRecord" 
            WHERE "leetcoderating" IS NOT NULL
            GROUP BY "department";
            
            2. Multi-platform analysis:
            SELECT 
                "studentid",
                "leetcoderating",
                "codeforcesrating",
                "codechefrating",
                ("leetcoderating" + "codeforcesrating" + "codechefrating") as total_rating
            FROM "StudentRecord"
            WHERE "leetcoderating" IS NOT NULL 
                AND "codeforcesrating" IS NOT NULL 
                AND "codechefrating" IS NOT NULL;
            
            3. Time-based queries:
            SELECT * FROM "StudentRecord" 
            WHERE "contestdate" >= CURRENT_DATE - INTERVAL '30 days'
            ORDER BY "contestdate" DESC;
            """
        ]
        
        # Create documents from knowledge base
        documents = []
        for i, content in enumerate(sql_knowledge):
            doc = Document(
                page_content=content,
                metadata={"source": f"sql_knowledge_{i}", "type": "sql_documentation"}
            )
            documents.append(doc)
        
        # Split documents into chunks
        text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=500,
            chunk_overlap=50,
            separators=["\n\n", "\n", ". ", " "]
        )
        
        split_docs = text_splitter.split_documents(documents)
        
        # Create or get collection
        try:
            collection = self.chroma_client.get_collection("sql_knowledge")
            print("✅ Existing ChromaDB collection loaded")
        except:
            collection = self.chroma_client.create_collection(
                name="sql_knowledge",
                metadata={"description": "SQL and database knowledge base"}
            )
            print("✅ New ChromaDB collection created")
        
        # Initialize vector store
        self.vector_store = Chroma(
            client=self.chroma_client,
            collection_name="sql_knowledge",
            embedding_function=self.embeddings
        )
        
        # Add documents to vector store if collection is new
        if collection.count() == 0:
            self.vector_store.add_documents(split_docs)
            print(f"✅ Added {len(split_docs)} documents to knowledge base")
        else:
            print(f"✅ Knowledge base already contains {collection.count()} documents")
    
    def get_relevant_context(self, question: str, k: int = 3) -> Tuple[List[str], str]:
        """Retrieve relevant context for the question"""
        try:
            # Search for relevant documents
            docs = self.vector_store.similarity_search(question, k=k)
            
            # Extract context
            context_docs = [doc.page_content for doc in docs]
            combined_context = "\n\n".join(context_docs)
            
            return context_docs, combined_context
            
        except Exception as e:
            print(f"RAG retrieval error: {e}")
            return [], ""

class NL2SQLRAGConverter:
    """Enhanced NL2SQL converter with RAG capabilities"""
    
    def __init__(self, db_config: Dict[str, str], model_name: str = "llama3.2:latest"):
        """
        Initialize the NL2SQL converter with RAG
        
        Args:
            db_config: Database connection configuration
            model_name: Ollama model name
        """
        self.db_config = db_config
        self.llm = Ollama(model=model_name, temperature=0)
        self.sql_parser = SQLQueryParser()
        
        # Initialize RAG manager
        print("🔄 Initializing RAG system...")
        self.rag_manager = RAGManager()
        print("✅ RAG system initialized")
        
        # Database schema information
        self.schema_info = """
        Database Schema for StudentRecord table:
        
        Table: StudentRecord
        Columns:
        - id: TEXT (Primary Key, UUID)
        - studentid: TEXT (Student identifier)
        - leetcodeid: TEXT (LeetCode username)
        - codeforcesid: TEXT (Codeforces username)
        - codechefid: TEXT (CodeChef username)
        - leetcoderating: INTEGER (LeetCode rating)
        - codeforcesrating: INTEGER (Codeforces rating)
        - codechefrating: INTEGER (CodeChef rating)
        - leetcodeproblemcount: INTEGER (Number of problems solved on LeetCode)
        - department: TEXT (Academic department)
        - batch: TEXT (Academic batch/year)
        - platform: Platform ENUM ('LEETCODE', 'CODEFORCES', 'CODECHEF')
        - contestname: TEXT (Contest name)
        - contestrank: INTEGER (Rank in contest)
        - contestdate: TIMESTAMP WITH TIME ZONE (Contest date)
        - createdat: TIMESTAMP WITH TIME ZONE (Record creation time)
        - updatedat: TIMESTAMP WITH TIME ZONE (Record update time)
        """
        
        self.graph = self.create_graph()
    
    def create_graph(self) -> StateGraph:
        """Create the LangGraph workflow with RAG"""
        workflow = StateGraph(NL2SQLRAGState)
        
        # Add nodes
        workflow.add_node("retrieve_context", self.retrieve_context)
        workflow.add_node("generate_sql", self.generate_sql_query)
        workflow.add_node("execute_query", self.execute_sql_query)
        workflow.add_node("generate_answer", self.generate_natural_answer)
        workflow.add_node("handle_error", self.handle_error)
        
        # Define the workflow
        workflow.set_entry_point("retrieve_context")
        workflow.add_edge("retrieve_context", "generate_sql")
        workflow.add_edge("generate_sql", "execute_query")
        workflow.add_conditional_edges(
            "execute_query",
            self.should_handle_error,
            {
                "error": "handle_error",
                "success": "generate_answer"
            }
        )
        workflow.add_edge("generate_answer", END)
        workflow.add_edge("handle_error", END)
        
        return workflow.compile()
    
    def retrieve_context(self, state: NL2SQLRAGState) -> NL2SQLRAGState:
        """Retrieve relevant context using RAG"""
        try:
            context_docs, rag_context = self.rag_manager.get_relevant_context(
                state["question"], k=3
            )
            
            return {
                **state, 
                "context_docs": context_docs,
                "rag_context": rag_context
            }
        except Exception as e:
            return {
                **state,
                "context_docs": [],
                "rag_context": "",
                "error": f"RAG context retrieval failed: {str(e)}"
            }
    
    def generate_sql_query(self, state: NL2SQLRAGState) -> NL2SQLRAGState:
        """Generate SQL query from natural language question using RAG context"""
        prompt = PromptTemplate(
            template="""
            You are a SQL expert with access to relevant documentation and examples.
            Convert the following natural language question into a SQL query.
            
            {schema_info}
            
            Relevant Context and Examples:
            {rag_context}
            
            Question: {question}
            
            Important guidelines:
            1. Use double quotes for table and column names (e.g., "StudentRecord", "studentId")
            2. For Platform enum, use values: 'LEETCODE', 'CODEFORCES', 'CODECHEF'
            3. Write efficient queries with proper WHERE clauses when needed
            4. Use appropriate aggregation functions (COUNT, AVG, MAX, MIN, SUM) when needed
            5. For date comparisons, use proper TIMESTAMP formatting
            6. Handle NULL values appropriately
            7. Use the provided examples and context to guide your query construction
            8. Return only the SQL query, no explanations
            
            SQL Query:
            """,
            input_variables=["schema_info", "rag_context", "question"]
        )
        
        try:
            formatted_prompt = prompt.format(
                schema_info=self.schema_info,
                rag_context=state["rag_context"],
                question=state["question"]
            )
            
            response = self.llm.invoke(formatted_prompt)
            sql_query = self.sql_parser.parse(response)
            
            return {**state, "sql_query": sql_query}
            
        except Exception as e:
            return {**state, "error": f"Failed to generate SQL query: {str(e)}"}
    
    def execute_sql_query(self, state: NL2SQLRAGState) -> NL2SQLRAGState:
        """Execute the generated SQL query"""
        try:
            # Connect to database
            conn = psycopg2.connect(**self.db_config)
            cursor = conn.cursor(cursor_factory=RealDictCursor)
            
            # Execute query
            cursor.execute(state["sql_query"])
            
            # Fetch results
            if state["sql_query"].strip().upper().startswith("SELECT"):
                results = cursor.fetchall()
                # Convert to list of dictionaries
                query_result = [dict(row) for row in results]
            else:
                # For INSERT, UPDATE, DELETE operations
                conn.commit()
                query_result = [{"affected_rows": cursor.rowcount}]
            
            cursor.close()
            conn.close()
            
            return {**state, "query_result": query_result}
            
        except Exception as e:
            return {**state, "error": f"SQL execution error: {str(e)}"}
    
    def should_handle_error(self, state: NL2SQLRAGState) -> str:
        """Decide whether to handle error or proceed"""
        return "error" if state.get("error") else "success"
    
    def handle_error(self, state: NL2SQLRAGState) -> NL2SQLRAGState:
        """Handle errors and provide user-friendly messages with RAG context"""
        error_msg = state.get("error", "Unknown error occurred")
        
        # Use RAG context to provide better error handling
        context_hint = ""
        if state.get("rag_context"):
            context_hint = "\n\nBased on the documentation, here are some suggestions:\n"
            if "column" in error_msg.lower():
                context_hint += "- Check column names and use double quotes\n"
            if "enum" in error_msg.lower() or "platform" in error_msg.lower():
                context_hint += "- For platform, use: 'LEETCODE', 'CODEFORCES', 'CODECHEF'\n"
            if "null" in error_msg.lower():
                context_hint += "- Consider handling NULL values in your query\n"
        
        final_answer = f"""
        I encountered an error while processing your question: {error_msg}
        {context_hint}
        
        Please try rephrasing your question or check if:
        1. The question refers to valid table columns
        2. The question is clear and specific
        3. Any date formats are reasonable
        
        Example questions you can ask:
        - "Show me all students from CSE department"
        - "What is the average LeetCode rating?"
        - "Who has the highest Codeforces rating?"
        - "List students who participated in contests on LEETCODE platform"
        """
        
        return {**state, "final_answer": final_answer}
    
    def generate_natural_answer(self, state: NL2SQLRAGState) -> NL2SQLRAGState:
        """Generate natural language answer from query results using RAG context"""
        prompt = PromptTemplate(
            template="""
            You are a helpful assistant that explains database query results in natural language.
            Use the provided context to give more informative answers.
            
            Original Question: {question}
            SQL Query Used: {sql_query}
            Query Results: {query_result}
            
            Relevant Context:
            {rag_context}
            
            Please provide a clear, natural language answer to the original question based on the query results.
            Use the context to provide additional insights where relevant.
            
            Guidelines:
            1. Be concise and direct
            2. Include relevant numbers and statistics
            3. If no results found, explain that clearly
            4. Format the response in a user-friendly way
            5. Don't mention technical database details unless relevant
            6. Use context to provide additional explanations when helpful
            
            Answer:
            """,
            input_variables=["question", "sql_query", "query_result", "rag_context"]
        )
        
        try:
            formatted_prompt = prompt.format(
                question=state["question"],
                sql_query=state["sql_query"],
                query_result=json.dumps(state["query_result"], indent=2, default=str),
                rag_context=state["rag_context"][:1000]  # Limit context size
            )
            
            response = self.llm.invoke(formatted_prompt)
            final_answer = response.strip()
            
            return {**state, "final_answer": final_answer}
            
        except Exception as e:
            return {**state, "final_answer": f"Generated results but failed to create natural language response: {str(e)}"}
    
    def query(self, question: str) -> Dict[str, Any]:
        """Main method to process natural language questions with RAG"""
        initial_state = NL2SQLRAGState(
            question=question,
            sql_query="",
            query_result=[],
            final_answer="",
            error=None,
            context_docs=[],
            rag_context=""
        )
        
        # Run the graph
        result = self.graph.invoke(initial_state)
        
        return {
            "question": result["question"],
            "sql_query": result["sql_query"],
            "results": result["query_result"],
            "answer": result["final_answer"],
            "error": result.get("error"),
            "context_docs": result.get("context_docs", []),
            "rag_context": result.get("rag_context", "")
        }
    
    def add_knowledge(self, content: str, metadata: Dict[str, Any] = None):
        """Add new knowledge to the RAG system"""
        try:
            doc = Document(
                page_content=content,
                metadata=metadata or {"source": "user_added", "type": "custom"}
            )
            
            # Split the document
            text_splitter = RecursiveCharacterTextSplitter(
                chunk_size=500,
                chunk_overlap=50
            )
            split_docs = text_splitter.split_documents([doc])
            
            # Add to vector store
            self.rag_manager.vector_store.add_documents(split_docs)
            return f"✅ Added {len(split_docs)} knowledge chunks to RAG system"
            
        except Exception as e:
            return f"❌ Failed to add knowledge: {str(e)}"