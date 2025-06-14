import os
import json
from typing import Dict, Any, List, Optional
from datetime import datetime
import psycopg2
from psycopg2.extras import RealDictCursor
import pandas as pd
from langchain_community.llms import Ollama
from langchain.prompts import PromptTemplate
from langchain.schema import BaseOutputParser
from langgraph.graph import Graph, StateGraph, END
from langgraph.graph.message import add_messages
from typing_extensions import TypedDict, Annotated

# State definition for LangGraph
class NL2SQLState(TypedDict):
    question: str
    sql_query: str
    query_result: List[Dict[str, Any]]
    final_answer: str
    error: Optional[str]

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

class NL2SQLConverter:
    def __init__(self, db_config: Dict[str, str], model_name: str = "llama3.2:latest"):
        """
        Initialize the NL2SQL converter
        
        Args:
            db_config: Database connection configuration
            model_name: Ollama model name (free models: llama3.2:latest, codellama, etc.)
        """
        self.db_config = db_config
        self.llm = Ollama(model=model_name, temperature=0)
        self.sql_parser = SQLQueryParser()
        
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
        """Create the LangGraph workflow"""
        workflow = StateGraph(NL2SQLState)
        
        # Add nodes
        workflow.add_node("generate_sql", self.generate_sql_query)
        workflow.add_node("execute_query", self.execute_sql_query)
        workflow.add_node("generate_answer", self.generate_natural_answer)
        workflow.add_node("handle_error", self.handle_error)
        
        # Define the workflow
        workflow.set_entry_point("generate_sql")
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
    
    def generate_sql_query(self, state: NL2SQLState) -> NL2SQLState:
        """Generate SQL query from natural language question"""
        prompt = PromptTemplate(
            template="""
            You are a SQL expert. Convert the following natural language question into a SQL query.
            
            {schema_info}
            
            Question: {question}
            
            Important guidelines:
            1. Use double quotes for table and column names (e.g., "StudentRecord", "studentId")
            2. For Platform enum, use values: 'LEETCODE', 'CODEFORCES', 'CODECHEF'
            3. Write efficient queries with proper WHERE clauses when needed
            4. Use appropriate aggregation functions (COUNT, AVG, MAX, MIN, SUM) when needed
            5. For date comparisons, use proper TIMESTAMP formatting
            6. Return only the SQL query, no explanations
            
            SQL Query:
            """,
            input_variables=["schema_info", "question"]
        )
        
        try:
            formatted_prompt = prompt.format(
                schema_info=self.schema_info,
                question=state["question"]
            )
            
            response = self.llm.invoke(formatted_prompt)
            sql_query = self.sql_parser.parse(response)
            
            return {**state, "sql_query": sql_query}
        except Exception as e:
            return {**state, "error": f"Failed to generate SQL query: {str(e)}"}
    
    def execute_sql_query(self, state: NL2SQLState) -> NL2SQLState:
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
    
    def should_handle_error(self, state: NL2SQLState) -> str:
        """Decide whether to handle error or proceed"""
        return "error" if state.get("error") else "success"
    
    def handle_error(self, state: NL2SQLState) -> NL2SQLState:
        """Handle errors and provide user-friendly messages"""
        error_msg = state.get("error", "Unknown error occurred")
        
        final_answer = f"""
        I encountered an error while processing your question: {error_msg}
        
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
    
    def generate_natural_answer(self, state: NL2SQLState) -> NL2SQLState:
        """Generate natural language answer from query results"""
        prompt = PromptTemplate(
            template="""
            You are a helpful assistant that explains database query results in natural language.
            
            Original Question: {question}
            SQL Query Used: {sql_query}
            Query Results: {query_result}
            
            Please provide a clear, natural language answer to the original question based on the query results.
            
            Guidelines:
            1. Be concise and direct
            2. Include relevant numbers and statistics
            3. If no results found, explain that clearly
            4. Format the response in a user-friendly way
            5. Don't mention technical database details unless relevant
            
            Answer:
            """,
            input_variables=["question", "sql_query", "query_result"]
        )
        
        try:
            formatted_prompt = prompt.format(
                question=state["question"],
                sql_query=state["sql_query"],
                query_result=json.dumps(state["query_result"], indent=2, default=str)
            )
            
            response = self.llm.invoke(formatted_prompt)
            final_answer = response.strip()
            
            return {**state, "final_answer": final_answer}
            
        except Exception as e:
            return {**state, "final_answer": f"Generated results but failed to create natural language response: {str(e)}"}
    
    def query(self, question: str) -> Dict[str, Any]:
        """Main method to process natural language questions"""
        initial_state = NL2SQLState(
            question=question,
            sql_query="",
            query_result=[],
            final_answer="",
            error=None
        )
        
        # Run the graph
        result = self.graph.invoke(initial_state)
        
        return {
            "question": result["question"],
            "sql_query": result["sql_query"],
            "results": result["query_result"],
            "answer": result["final_answer"],
            "error": result.get("error")
        }

# Example usage and testing
def main():
 
    db_config = {
    'host': 'ep-falling-sky-a8r9jwvy-pooler.eastus2.azure.neon.tech',
    'database': 'neondb',
    'user': 'neondb_owner',
    'password': 'npg_5LS7pKYICxmZ',
    'port': 5432,
    'sslmode': 'require'
    }

    # Initialize the converter
    converter = NL2SQLConverter(db_config, model_name="llama3.2:latest")
    # Example questions to test
    test_questions = [
        "Show me all students from CSE department",
        "What is the average LeetCode rating of all students?",
        "Who has the highest Codeforces rating?",
        "List students who participated in contests on LEETCODE platform",
        "How many students are there in each department?",
        "Show me students with LeetCode rating above 1500",
        "What are the recent contests in the last 30 days?",
        "Find students who have solved more than 100 LeetCode problems"
    ]
    
    print("🚀 Natural Language to SQL Converter Ready!")
    print("=" * 50)
    
    # Interactive mode
    while True:
        print("\nOptions:")
        print("1. Ask a custom question")
        print("2. Test with example questions")
        print("3. Exit")
        
        choice = input("\nEnter your choice (1-3): ").strip()
        
        if choice == "1":
            question = input("\nEnter your question: ").strip()
            if question:
                print("\n" + "="*50)
                print(f"Processing: {question}")
                print("="*50)
                
                result = converter.query(question)
                
                print(f"\n📝 Generated SQL Query:")
                print(result["sql_query"])
                
                if result["error"]:
                    print(f"\n❌ Error: {result['error']}")
                else:
                    print(f"\n📊 Query Results: {len(result['results'])} rows")
                    if result["results"] and len(result["results"]) <= 5:
                        for i, row in enumerate(result["results"], 1):
                            print(f"Row {i}: {row}")
                
                print(f"\n🤖 Answer:")
                print(result["answer"])
        
        elif choice == "2":
            print("\nTesting example questions:")
            for i, question in enumerate(test_questions, 1):
                print(f"\n{i}. Testing: {question}")
                result = converter.query(question)
                print(f"   SQL: {result['sql_query'][:100]}...")
                if result["error"]:
                    print(f"   Error: {result['error']}")
                else:
                    print(f"   Results: {len(result['results'])} rows")
        
        elif choice == "3":
            print("Goodbye! 👋")
            break
        
        else:
            print("Invalid choice. Please try again.")

if __name__ == "__main__":
    # Install required packages first:
    # pip install psycopg2-binary pandas langchain-community ollama langgraph
    
    # Make sure Ollama is installed and running:
    # curl -fsSL https://ollama.ai/install.sh | sh
    # ollama pull llama3.1
    
    main()
